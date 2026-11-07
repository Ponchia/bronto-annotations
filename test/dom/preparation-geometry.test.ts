// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractedAnchorFromElement, prepareDomAnnotations, validateDomAnchors } from '../../src/dom/index.js';
import type { Box } from '../../src/index.js';

function fixture(box: Box = { x: 10, y: 20, width: 80, height: 40 }) {
  document.body.innerHTML='<svg viewBox="0 0 400 300"><path id="route" data-anchor-id="source-route" /></svg>';
  const svg=document.querySelector('svg') as SVGSVGElement;
  const path=document.querySelector('path') as SVGGeometryElement;
  path.getBBox=vi.fn(() => ({...box}) as DOMRect);
  path.getTotalLength=vi.fn(() => 20);
  path.getPointAtLength=vi.fn(distance => ({x:distance,y:30}) as DOMPoint);
  return {svg,path,spec:{selector:'#route',coordinateSpace:svg,note:{title:'Route'}}};
}

afterEach(() => { document.body.innerHTML=''; vi.restoreAllMocks(); });

describe('DOM preparation validates the geometry it returns', () => {
  it('extracts a box and its anchor from one element measurement', () => {
    const {path,svg}=fixture();let reads=0;
    path.getBBox=vi.fn(() => ({x:++reads*10,y:20,width:80,height:40}) as DOMRect);
    const result=extractedAnchorFromElement(path,{coordinateSpace:svg});
    expect(reads).toBe(1);
    expect(result.box).toEqual({x:10,y:20,width:80,height:40});
    expect(result.anchor).toEqual({type:'box',box:result.box});
    expect(result.point).toEqual({x:50,y:40});
  });

  it('prepares and validates one snapshot rather than reading a changing box again', () => {
    const {path,spec}=fixture();let reads=0;
    path.getBBox=vi.fn(() => ({x:reads++===0?10:NaN,y:20,width:80,height:40}) as DOMRect);
    const result=prepareDomAnnotations(document,[spec],{assert:true,obstacles:false});
    expect(reads).toBe(1);
    expect(result.validation.ok).toBe(true);
    expect(result.annotations[0]?.anchor).toEqual({type:'box',box:{x:10,y:20,width:80,height:40}});
    expect(result.annotations[0]?.id).toBe('route');
  });

  it.each([NaN,Infinity,-Infinity])('rejects a sampled path coordinate %s despite finite element bounds', value => {
    const {path,spec}=fixture();path.getPointAtLength=()=>({x:value,y:30}) as DOMPoint;
    const request={...spec,kind:'path' as const};
    const report=validateDomAnchors(document,[request]);
    expect(report.ok).toBe(false);
    expect(report.diagnostics[0]?.status).toBe('invalid');
    expect(()=>prepareDomAnnotations(document,[request],{assert:true})).toThrow(/finite/);
    const permissive=prepareDomAnnotations(document,[request],{obstacles:false});
    expect(permissive.validation.ok).toBe(false);
    expect(permissive.annotations).toHaveLength(1);
  });

  it('rejects finite box fields with nonfinite far edges', () => {
    const {spec}=fixture({x:Number.MAX_VALUE,y:0,width:Number.MAX_VALUE,height:20});
    expect(validateDomAnchors(document,[spec]).ok).toBe(false);
    expect(()=>prepareDomAnnotations(document,[spec],{assert:true})).toThrow(/finite/);
  });

  it('rejects finite path samples whose resolved midpoint overflows', () => {
    const {path,spec}=fixture();
    path.getPointAtLength=distance=>({x:distance===0?0:Number.MAX_VALUE,y:distance===0?0:Number.MAX_VALUE}) as DOMPoint;
    expect(validateDomAnchors(document,[{...spec,kind:'path'}]).ok).toBe(false);
  });

  it('samples a valid path only once during strict preparation', () => {
    const {path,spec}=fixture();
    const result=prepareDomAnnotations(document,[{...spec,kind:'path'}],{assert:true,obstacles:false});
    expect(path.getBBox).toHaveBeenCalledTimes(1);
    expect(path.getTotalLength).toHaveBeenCalledTimes(1);
    expect(path.getPointAtLength).toHaveBeenCalledTimes(2);
    expect(result.annotations[0]?.anchor).toEqual({type:'path',points:[{x:0,y:30},{x:20,y:30}]});
  });

  it('keeps independent options for two specs selecting the same element', () => {
    const {spec}=fixture();
    const result=prepareDomAnnotations(document,[{...spec,id:'box'},{...spec,id:'point',kind:'point',inflate:2}],{assert:true,obstacles:false});
    expect(result.annotations.map(note=>note.anchor)).toEqual([
      {type:'box',box:{x:10,y:20,width:80,height:40}},
      {type:'point',point:{x:50,y:40}}
    ]);
    expect(result.annotations.map(note=>note.id)).toEqual(['box','point']);
  });

  it('refreshes a later preparation rather than caching across calls', () => {
    const {path,spec}=fixture();
    const first=prepareDomAnnotations(document,[spec],{assert:true});
    path.getBBox=()=>({x:100,y:20,width:80,height:40}) as DOMRect;
    const second=prepareDomAnnotations(document,[spec],{assert:true});
    expect(first.annotations[0]?.anchor).toEqual({type:'box',box:{x:10,y:20,width:80,height:40}});
    expect(second.annotations[0]?.anchor).toEqual({type:'box',box:{x:100,y:20,width:80,height:40}});
  });

  it('preserves explicit, element and fallback identities', () => {
    const {path,spec}=fixture();
    const explicit=prepareDomAnnotations(document,[{...spec,id:''}],{assert:true,obstacles:false});
    expect(explicit.annotations[0]?.id).toBe('');
    expect(explicit.validation.diagnostics[0]?.id).toBe('');
    path.removeAttribute('id');
    const data=prepareDomAnnotations(document,[{...spec,selector:'path'}],{assert:true,obstacles:false});
    expect(data.annotations[0]?.id).toBe('source-route');
    expect(data.validation.diagnostics[0]?.id).toBe('source-route');
    path.removeAttribute('data-anchor-id');
    expect(prepareDomAnnotations(document,[{...spec,selector:'path'}],{assert:true,obstacles:false}).annotations[0]?.id).toBe('path');
  });

  it('preserves measurement exceptions, malformed selector errors and missing diagnostics', () => {
    const {path,spec}=fixture();const failure=new Error('Host measurement failed');path.getBBox=()=>{throw failure;};
    expect(()=>validateDomAnchors(document,[spec])).toThrow(failure);
    expect(()=>prepareDomAnnotations(document,[spec],{obstacles:false})).toThrow(failure);
    expect(()=>validateDomAnchors(document,[{selector:'['}])).toThrow();
    const missing=prepareDomAnnotations(document,[{selector:'.absent',note:{title:'Missing'}}],{obstacles:false});
    expect(missing.validation.diagnostics[0]?.status).toBe('missing');
    expect(missing.annotations).toEqual([]);
  });
});
