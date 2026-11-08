import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { request, type APIRequestContext } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyDemoDestination } from '../../scripts/verify-demo-destination.mjs';

const servers: Server[]=[];
const clients: APIRequestContext[]=[];
async function fixture(handle: (count: number, incoming: IncomingMessage, response: ServerResponse) => void) {
  let calls=0;
  const server=createServer((incoming,response)=>handle(++calls,incoming,response));servers.push(server);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('Missing test listener');
  const client=await request.newContext();clients.push(client);
  return {url:`http://127.0.0.1:${address.port}/#playground`,client,calls:()=>calls};
}
afterEach(async()=>{
  await Promise.all(clients.splice(0).map(client=>client.dispose()));
  await Promise.all(servers.splice(0).map(server=>new Promise<void>((resolve,reject)=>{
    server.close(error=>error?reject(error):resolve());server.closeAllConnections();
  })));
});

describe('bounded demo destination transport recovery',()=>{
  it('recovers one connection reset, then validates the real response and fragment',async()=>{
    const f=await fixture((count,incoming,response)=>{
      if(count===1){incoming.socket.destroy();return;}
      response.writeHead(200,{'content-type':'text/html'}).end('<h1>Demo</h1><section id="playground"></section>');
    });
    await verifyDemoDestination(f.client,f.url,true);
    expect(f.calls()).toBe(2);
  });
  it('fails after the single retry if the connection keeps resetting',async()=>{
    const f=await fixture((_count,incoming)=>incoming.socket.destroy());
    await expect(verifyDemoDestination(f.client,f.url)).rejects.toThrow(/ECONNRESET|socket hang up/);
    expect(f.calls()).toBe(2);
  });
  it.each([404,500])('does not retry or accept HTTP %s',async status=>{
    const f=await fixture((_count,_incoming,response)=>response.writeHead(status).end('<h1>Error</h1>'));
    await expect(verifyDemoDestination(f.client,f.url)).rejects.toThrow();
    expect(f.calls()).toBe(1);
  });
  it('does not retry or accept a successful response without an actual guide heading',async()=>{
    const f=await fixture((_count,_incoming,response)=>response.end('<p>Wrong artifact</p>'));
    await expect(verifyDemoDestination(f.client,f.url)).rejects.toThrow();
    expect(f.calls()).toBe(1);
  });
  it('still rejects a missing required playground fragment after transport recovery',async()=>{
    const f=await fixture((count,incoming,response)=>{
      if(count===1){incoming.socket.destroy();return;}
      response.end('<h1>Wrong destination</h1>');
    });
    await expect(verifyDemoDestination(f.client,f.url,true)).rejects.toThrow();
    expect(f.calls()).toBe(2);
  });
  it('accepts an ordinary guide with no transport retry or playground requirement',async()=>{
    const f=await fixture((_count,_incoming,response)=>response.end('<h1>Guide</h1>'));
    await verifyDemoDestination(f.client,f.url);
    expect(f.calls()).toBe(1);
  });
  it('keeps the bounded helper on the actual browser-navigation path',()=>{
    const script=readFileSync(new URL('../../scripts/verify-demo-navigation-browser.mjs',import.meta.url),'utf8');
    expect(script).toContain("from './verify-demo-destination.mjs'");
    expect(script).toContain('await verifyDemoDestination(page.request, href, index === 0)');
    expect(script).not.toContain('page.request.get(href)');
  });
});
