// Jitterbug twister hero animation. Size the container with CSS; the canvas fills it.
// `three` is resolved by the import map in _includes/partials/twister.njk.

import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// ─── Settings ────────────────────────────────────────────────────────────────
export const DEFAULTS = {
	model: 'tet',          // 'tet' (Fuller's jitterbug) | 'oct' | 'ico'
	dither: 'stipple',     // 'stipple' | 'aligned' | 'object' | 'screen' | 'bayer' | 'off'
	pitch: 2,              // dither screen pitch (CSS px)
	markWeight: 0.4,       // dot / rule weight
	exposure: 1,           // scales all light
	bounce: 2,             // 1 = constant speed, 2 = true bounce off the closed states
	cycle: 4,              // seconds per closed → open → closed
	spin: 0.18,            // turntable speed (rad/s)
	insideTone: 0.45,      // how much darker the inside faces are
	lightStrength: 0.55,   // key light only
	ambient: 0.45,         // soft overhead fill
	lightAngle: 320,       // degrees around
	lightHeight: 50,       // degrees up
	lineWeight: 0.5,       // edge width (CSS px)
	fov: 10.5,             // camera field of view (degrees); smaller = tighter framing
	paper: '#ffffff',
	ink: '#000000',
};
// ─────────────────────────────────────────────────────────────────────────────

export function mountTwister(wrap, overrides = {}) {
  const C = { ...DEFAULTS, ...overrides };
  const PHI = (1 + Math.sqrt(5)) / 2, DEG = Math.PI / 180;
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>Math.hypot(a[0],a[1],a[2]),unit=a=>mul(a,1/norm(a)),dist=(a,b)=>norm(sub(a,b));
  const cross=(k,v)=>[k[1]*v[2]-k[2]*v[1],k[2]*v[0]-k[0]*v[2],k[0]*v[1]-k[1]*v[0]];
  const rot=(v,k,t)=>{const c=Math.cos(t),s=Math.sin(t),d=dot(v,k),x=cross(k,v);return[0,1,2].map(i=>v[i]*c+x[i]*s+k[i]*d*(1-c))};
  const signs=v=>{let o=[[]];for(const x of v){const n=[];for(const p of o){if(x===0)n.push([...p,0]);else{n.push([...p,x]);n.push([...p,-x])}}o=n}return o};
  const cyc=v=>[[v[0],v[1],v[2]],[v[1],v[2],v[0]],[v[2],v[0],v[1]]];
  const perms=v=>[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]].map(p=>p.map(i=>v[i]));
  const uniq=P=>{const o=[];for(const p of P)if(!o.some(q=>dist(p,q)<1e-6))o.push(p);return o};

  // faces of the closed solid lying on a set of symmetry axes
  function planeFaces(V,axes,n){return axes.map(a=>{const k=unit(a);let h=-1e9;for(const p of V)h=Math.max(h,dot(p,k));const top=V.filter(p=>Math.abs(dot(p,k)-h)<1e-6);if(top.length!==n)return null;
    const c=mul(top.reduce(add,[0,0,0]),1/n);if(dist(unit(c),k)>1e-6)return null;const e1=unit(sub(top[0],c)),e2=cross(k,e1);
    top.sort((p,q)=>Math.atan2(dot(sub(p,c),e2),dot(sub(p,c),e1))-Math.atan2(dot(sub(q,c),e2),dot(sub(q,c),e1)));return{k,d0:dot(c,k),U:top.map(p=>sub(p,c))}}).filter(Boolean)}

  // Two families of polygons slide along and turn about their own axes; one shared corner is held
  // joined and solved by Newton's method, tabulated once at 0.25° steps.
  function twister(name){let V,A,B,nA,nB;
    if(name==='tet'){V=uniq(perms([1,1,0]).flatMap(signs));A=signs([1,1,1]).filter(v=>v[0]*v[1]*v[2]>0);B=signs([1,1,1]).filter(v=>v[0]*v[1]*v[2]<0);nA=3;nB=3}
    if(name==='oct'){V=uniq(perms([1,1,1+Math.SQRT2]).flatMap(signs));A=signs([1,1,1]);B=uniq(perms([1,0,0]).flatMap(signs));nA=3;nB=4}
    if(name==='ico'){const AX5=uniq([...cyc([0,1,PHI]).flatMap(signs),...cyc([0,PHI,1]).flatMap(signs)]);
      const AX3=uniq([...signs([1,1,1]),...cyc([0,1/PHI,PHI]).flatMap(signs),...cyc([0,PHI,1/PHI]).flatMap(signs)]);
      V=uniq([[1,1,PHI**3],[PHI**2,PHI,2*PHI],[2+PHI,0,PHI**2]].flatMap(cyc).flatMap(signs));A=AX3;B=AX5;nA=3;nB=5}
    const FA=planeFaces(V,A,nA),FB=planeFaces(V,B,nB);let J=null;
    outer:for(let a=0;a<nA;a++){const p=add(mul(FA[0].k,FA[0].d0),FA[0].U[a]);for(let j=0;j<FB.length;j++)for(let b=0;b<nB;b++)if(dist(p,add(mul(FB[j].k,FB[j].d0),FB[j].U[b]))<1e-6){J=[a,j,b];break outer}}
    const pos=(f,d,t,a)=>add(mul(f.k,d),rot(f.U[a],f.k,t));
    const Fn=(tA,[dA,dB,tB])=>sub(pos(FA[0],dA,tA,J[0]),pos(FB[J[1]],dB,tB,J[2]));
    const det=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    function solve(tA,x){for(let it=0;it<60;it++){const f=Fn(tA,x);const cols=[0,1,2].map(j=>{const y=[...x];y[j]+=1e-7;return mul(sub(Fn(tA,y),f),1e7)});const M=[0,1,2].map(i=>[cols[0][i],cols[1][i],cols[2][i]]),b=mul(f,-1),D=det(M);if(Math.abs(D)<1e-14)break;const dx=[0,1,2].map(c=>det(M.map((r,i)=>r.map((v,j)=>j===c?b[i]:v)))/D);x=add(x,dx);if(norm(dx)<1e-12)break}return x}
    const STEP=0.25,N=Math.round(360/STEP),tab=[];let x=[FA[0].d0,FB[0].d0,0];
    for(let k=0;k<=N;k++){const tA=k*STEP*DEG;const n=tab.length;const g=n>1?[1,2,3].map(i=>2*tab[n-1][i]-tab[n-2][i]):x;x=solve(tA,g);
      if(n){const pv=tab[n-1][3];x[2]=pv+Math.atan2(Math.sin(x[2]-pv),Math.cos(x[2]-pv))}tab.push([tA,...x])}
    const polys=al=>{al=((al%360)+360)%360;const f=al/STEP,k=Math.min(N-1,Math.floor(f)),u=f-k,r=tab[k].map((v,i)=>v+(tab[k+1][i]-v)*u);
      return[...FA.map(g=>g.U.map((_,a)=>pos(g,r[1],r[0],a))),...FB.map(g=>g.U.map((_,a)=>pos(g,r[2],r[3],a)))]};
    let R=0;for(let a=-60;a<=60;a+=0.5)for(const p of polys(a))for(const v of p)R=Math.max(R,norm(v));
    return{polys,R}}

  // blue-noise rank tile (void-and-cluster)
  function voidCluster(N,sigma,seed){const n=N*N,Rk=6,K=[];for(let dy=-Rk;dy<=Rk;dy++)for(let dx=-Rk;dx<=Rk;dx++)K.push(Math.exp(-(dx*dx+dy*dy)/(2*sigma*sigma)));
    let s=seed>>>0;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
    const bits=new Uint8Array(n),E=new Float64Array(n);
    const addE=(E,i,w)=>{const x=i%N,y=(i/N)|0;let k=0;for(let dy=-Rk;dy<=Rk;dy++){const yy=((y+dy)%N+N)%N*N;for(let dx=-Rk;dx<=Rk;dx++)E[yy+((x+dx)%N+N)%N]+=w*K[k++]}};
    let ones=0;while(ones<n*0.1){const i=(rnd()*n)|0;if(!bits[i]){bits[i]=1;addE(E,i,1);ones++}}
    const argE=(E,b,want,max)=>{let bi=-1,bv=max?-1e9:1e9;for(let i=0;i<n;i++)if(b[i]===want){const v=E[i];if(max?v>bv:v<bv){bv=v;bi=i}}return bi};
    for(let it=0;it<n;it++){const t=argE(E,bits,1,true);bits[t]=0;addE(E,t,-1);const v=argE(E,bits,0,false);if(v===t){bits[t]=1;addE(E,t,1);break}bits[v]=1;addE(E,v,1)}
    const rank=new Float32Array(n);
    {const b=bits.slice(),e=E.slice();let r=ones-1;while(r>=0){const t=argE(e,b,1,true);b[t]=0;addE(e,t,-1);rank[t]=r--}}
    {const b=bits.slice(),e=E.slice();let r=ones;while(r<n){const v=argE(e,b,0,false);b[v]=1;addE(e,v,1);rank[v]=r++}}
    for(let i=0;i<n;i++)rank[i]=(rank[i]+0.5)/n;return rank}

  const MODEL=twister(C.model);
  const MODES={off:0,screen:1,object:2,bayer:3,aligned:4,stipple:5};
  const bnTex=new THREE.DataTexture(voidCluster(64,1.5,1234),64,64,THREE.RedFormat,THREE.FloatType);
  bnTex.wrapS=bnTex.wrapT=THREE.RepeatWrapping;bnTex.magFilter=bnTex.minFilter=THREE.NearestFilter;bnTex.generateMipmaps=false;bnTex.needsUpdate=true;

  const renderer=new THREE.WebGLRenderer({antialias:true});
  const DPR=Math.min(2,window.devicePixelRatio||1);renderer.setPixelRatio(DPR);renderer.setClearColor(new THREE.Color(C.paper),1);renderer.autoClear=false;
  wrap.appendChild(renderer.domElement);renderer.domElement.style.display='block';
  const scene=new THREE.Scene(),lineScene=new THREE.Scene();
  const CAM=[0,2.6,10.6],CAMD=norm(CAM);
  const camera=new THREE.PerspectiveCamera(C.fov,2,0.1,100);camera.position.set(...CAM);camera.lookAt(0,0,0);

  const az=C.lightAngle*DEG,el=C.lightHeight*DEG;
  const toneMat=new THREE.ShaderMaterial({side:THREE.DoubleSide,
    uniforms:{uL:{value:new THREE.Vector3(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az))},uAmb:{value:C.ambient},uSun:{value:C.lightStrength},
      uMode:{value:MODES[C.dither]??5},uPitch:{value:C.pitch*DPR},uWt:{value:C.markWeight},uWpp:{value:0.01},uExp:{value:C.exposure},uIn:{value:C.insideTone},
      uRes:{value:new THREE.Vector2(1,1)},uBN:{value:bnTex},uPaper:{value:new THREE.Color(C.paper)},uInk:{value:new THREE.Color(C.ink)}},
    vertexShader:`attribute vec2 luv;attribute vec3 axis;uniform vec2 uRes;varying vec3 vN;varying vec2 vUv;varying vec2 vT;varying vec3 vW;
    void main(){vN=normal;vUv=luv;vW=(modelMatrix*vec4(position,1.0)).xyz;vec4 c0=projectionMatrix*modelViewMatrix*vec4(position,1.0);vec4 c1=projectionMatrix*modelViewMatrix*vec4(position+axis*0.05,1.0);
     vT=(c1.xy/c1.w-c0.xy/c0.w)*uRes;gl_Position=c0;}`,
    fragmentShader:`uniform vec3 uL,uPaper,uInk;uniform float uAmb,uSun,uPitch,uWt,uWpp,uExp,uIn;uniform int uMode;uniform sampler2D uBN;varying vec3 vN;varying vec2 vUv;varying vec2 vT;varying vec3 vW;
    float aaStep(float e,float x,float w){return 1.0-smoothstep(e-w,e+w,x);}
    float dots(vec2 p,float s,float r,float w){vec2 q=mat2(0.70710678,-0.70710678,0.70710678,0.70710678)*p;vec2 c=(fract(q/s)-0.5)*s;return aaStep(r,length(c),w);}
    float rule(float y,float s,float t,float w){float f=abs(fract(y/s)-0.5)*s;return aaStep(min(t,s)*0.5,f,w);}
    float bayer4(vec2 p){ivec2 i=ivec2(mod(p,4.0));int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(m[i.y*4+i.x])+0.5)/16.0;}
    float stipple(vec2 fc,float cell,float r0,float cov){
     float c0=min(0.6,3.14159*r0*r0/(cell*cell));float dark,rad;
     if(cov<=c0){dark=cov/max(c0,1e-4);rad=r0;}else{dark=1.0;rad=cell*mix(sqrt(c0/3.14159),0.74,(cov-c0)/(1.0-c0));}
     const float A=0.41887902;mat2 Rm=mat2(cos(A),sin(A),-sin(A),cos(A));vec2 q=Rm*fc;vec2 c=floor(q/cell);float ink=0.0;
     for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 s=c+vec2(float(i),float(j));vec2 blk=floor(s/64.0);
      vec2 sh=floor(fract(sin(vec2(dot(blk,vec2(127.1,311.7)),dot(blk,vec2(269.5,183.3))))*43758.5453)*64.0);
      float r=texture2D(uBN,(mod(s+sh,64.0)+0.5)/64.0).r;
      if(r<dark)ink=max(ink,aaStep(rad,length(q-(s+0.5)*cell),0.5));}
     return ink;}
    void main(){vec3 No=normalize(vN);bool inside=dot(No,cameraPosition-vW)<0.0;vec3 N=inside?-No:No;
     float hemi=mix(0.80,1.0,0.5+0.5*N.y);float ndl=max(0.0,dot(N,uL));
     float L=pow(clamp((uAmb*hemi+uSun*ndl)*uExp,0.0,1.0),1.0/2.2);if(inside)L*=uIn;
     if(uMode==0){gl_FragColor=vec4(mix(uInk,uPaper,L),1.0);return;}
     float S=uPitch,K=uWt;float ink=0.0;float w=0.5;float cov=clamp(1.0-L/0.97,0.0,1.0);
     if(uMode==5){float cell=0.6*S;ink=stipple(gl_FragCoord.xy,cell,0.5*cell*K,cov);}
     else{vec2 p;
      if(uMode==2){p=vUv/uWpp;w=max(0.35,0.6*length(fwidth(p)));}
      else if(uMode==4){float tl=length(vT);vec2 t=tl>1e-6?vT/tl:vec2(1.0,0.0);vec2 g=vec2(-t.y,t.x);p=vec2(dot(gl_FragCoord.xy,t),dot(gl_FragCoord.xy,g));}
      else p=gl_FragCoord.xy;
      if(uMode==3){float b=max(1.0,floor(S*0.35));ink=step(bayer4(floor(gl_FragCoord.xy/b)),cov);}
      else{float lv[8]=float[8](0.0,0.14,0.30,0.40,0.54,0.68,0.84,0.97);int k=0;float best=9.0;for(int i=0;i<8;i++){float d=abs(lv[i]-cov);if(d<best){best=d;k=i;}}
       if(k==1)ink=dots(p,S,0.21*S*K,w);else if(k==2)ink=dots(p,S,0.31*S*K,w);
       else if(k==3)ink=rule(p.y,0.8*S,0.32*S*K,w);else if(k==4)ink=rule(p.y,0.8*S,0.46*S*K,w);
       else if(k==5)ink=max(rule(p.y,0.8*S,0.34*S*K,w),rule(p.x,0.8*S,0.34*S*K,w));else if(k==6)ink=1.0-dots(p,0.8*S,0.18*S/K,w);else if(k==7)ink=1.0;}}
     gl_FragColor=vec4(mix(uPaper,uInk,ink),1.0);}`});
  toneMat.extensions={derivatives:true};
  const lineMat=new LineMaterial({color:new THREE.Color(C.ink),linewidth:C.lineWeight,worldUnits:false});
  lineMat.polygonOffset=true;lineMat.polygonOffsetFactor=-2;lineMat.polygonOffsetUnits=-8;

  const MAXV=600,plateGeo=new THREE.BufferGeometry();
  for(const[a,n]of[['position',3],['normal',3],['axis',3],['luv',2]])plateGeo.setAttribute(a,new THREE.BufferAttribute(new Float32Array(MAXV*n),n));
  const plateMesh=new THREE.Mesh(plateGeo,toneMat);plateMesh.frustumCulled=false;scene.add(plateMesh);
  const lineGeo=new LineSegmentsGeometry(),lines=new LineSegments2(lineGeo,lineMat);lines.frustumCulled=false;lineScene.add(lines);

  // normals point away from the centre so the shader can tell outside faces from inside ones
  function update(alpha,yaw){const cy=Math.cos(yaw),sy=Math.sin(yaw),s=1/MODEL.R;
    const tf=v=>{const x=v[0]*s,y=v[1]*s,z=v[2]*s;return[x*cy+z*sy,y,-x*sy+z*cy]};
    const P=MODEL.polys(alpha).map(pl=>pl.map(tf));
    const at=plateGeo.attributes,A=at.position.array,Nn=at.normal.array,X=at.axis.array,U=at.luv.array;let v=0;
    for(const poly of P){const c=mul(poly.reduce(add,[0,0,0]),1/poly.length);let n=unit(cross(sub(poly[0],c),sub(poly[1],c)));if(dot(n,c)<0)n=mul(n,-1);const e1=unit(sub(poly[1],poly[0])),e2=cross(n,e1);
      for(let k=0;k<poly.length;k++)for(const p of[c,poly[k],poly[(k+1)%poly.length]]){if(v>=MAXV)break;A.set(p,v*3);Nn.set(n,v*3);X.set(e1,v*3);const q=sub(p,c);U[v*2]=dot(q,e1);U[v*2+1]=dot(q,e2);v++}}
    plateGeo.setDrawRange(0,v);for(const a of['position','normal','axis','luv'])at[a].needsUpdate=true;
    const seg=[];for(const poly of P)for(let k=0;k<poly.length;k++)seg.push(...poly[k],...poly[(k+1)%poly.length]);
    lineGeo.setPositions(seg)}

  function draw(){renderer.clear();renderer.render(scene,camera);renderer.render(lineScene,camera)}
  function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
    lineMat.resolution.set(w,h);toneMat.uniforms.uWpp.value=2*Math.tan(C.fov/2*DEG)*CAMD/(h*DPR);toneMat.uniforms.uRes.value.set(w*DPR*0.5,h*DPR*0.5);
    if(!running){update(alpha,yaw);draw()}}

  // Bounce timing: leaves each closed state at full speed, slowest at the fully open form. At ±60° the
  // closed states coincide, so the pivots switch and the twist rotates on. alpha runs -60 → +60, looping.
  const alphaAt=t=>{const x=2*t-1;return Math.sign(x)*60*Math.pow(Math.abs(x),C.bounce)};
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tau=0.5,alpha=still?20:0,yaw=0.5,last=performance.now(),running=false,raf=0;
  function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;
    tau=(tau+dt/C.cycle)%1;alpha=alphaAt(tau);yaw+=dt*C.spin;update(alpha,yaw);draw();raf=requestAnimationFrame(frame)}
  function setRunning(on){if(on===running)return;running=on;if(on){last=performance.now();raf=requestAnimationFrame(frame)}else cancelAnimationFrame(raf)}
  new ResizeObserver(resize).observe(wrap);resize();
  new IntersectionObserver(([e])=>setRunning(e.isIntersecting&&!still)).observe(wrap);
  update(alpha,yaw);draw();
}
