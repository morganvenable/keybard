import{L as Br,P as cr,a as lr,n as j,C as qr,p as Gr,b as zr,c as Vr,d as Wr,e as Zr,D as ur,f as Hr,g as Yr,h as Xr,k as Sr}from"./index-Cwoo7TtH.js";const S=10,g=6,y=16,or=256,d=256,c=16,Z=21,jr=44,B=10,ar=12,Ar=12,Lr=6,ir=14,Qr=8+d*c,Cr=106664,Jr=Cr-Qr,_r=51,$r=0,rn=1,nn=2,Mr=3,Kr="keybard.fakeBoard.v1",en=[y,d,or,d];function q(){const _=new Uint8Array(d*B);for(let n=0;n<d;n++)_[n*B+8]=200,_[n*B+9]=0;return{keymap:new Uint8Array(y*S*g*2),macros:new Uint8Array(Cr),tapDance:_,combo:new Uint8Array(d*ar),keyOverride:new Uint8Array(d*Ar),altRepeatKey:new Uint8Array(d*Lr),leader:new Uint8Array(d*ir),labels:en.map(n=>new Uint8Array(n*c)),qmkSettings:tn(),magic:128,fragments:new Uint8Array(Z),custom:on(),rgb:Uint8Array.from([255,1,0,0,0]),identityName:"",defaultLayer:0,storageFlags:0}}function l(_,r,n){_[r]=n&255,_[r+1]=n>>8&255}function tn(){const _=new Uint8Array(jr);return l(_,0,175),l(_,2,5e3),l(_,4,30),l(_,6,16),l(_,8,1),l(_,10,15),l(_,12,40),l(_,14,10),l(_,16,80),l(_,18,8),l(_,20,40),l(_,22,50),l(_,24,200),_[26]=0,_[27]=0,_[28]=5,_[29]=9,l(_,30,10),l(_,32,80),_[34]=5,l(_,36,200),l(_,38,0),l(_,40,300),_[42]=1,_}function on(){const _=new Uint8Array(_r*2),r=(t,e,s=0)=>{_[t*2]=e,_[t*2+1]=s};r(0,3),r(1,1),r(2,3),r(3,0),r(4,1),r(5,3),r(6,15),r(7,0),r(8,1),r(9,0),r(10,7),r(11,1),r(12,1);for(let t=25;t<=29;t++)r(t,1);return[22015,5631,38399,2992,11263,33023,255,255,60159,49151,2992,27391,33023,33023,11263,54783].forEach((t,e)=>r(32+e,t>>8,t&255)),_}function pr(_){let r="";for(let n=0;n<_.length;n+=32768)r+=String.fromCharCode(..._.subarray(n,n+32768));return btoa(r)}function dr(_,r){const n=new Uint8Array(r),t=atob(_);for(let e=0;e<t.length&&e<r;e++)n[e]=t.charCodeAt(e);return n}function Tr(_){let r=_.length;for(;r>0&&_[r-1]===0;)r--;return _.subarray(0,r)}const Ir=["keymap","macros","tapDance","combo","keyOverride","altRepeatKey","leader","qmkSettings","fragments","custom","rgb"];function _n(_){const r={v:1,magic:_.magic,identityName:_.identityName,defaultLayer:_.defaultLayer,storageFlags:_.storageFlags};for(const n of Ir)r[n]=pr(Tr(_[n]));return _.labels.forEach((n,t)=>{r[`labels${t}`]=pr(Tr(n))}),JSON.stringify(r)}function sn(_){try{const r=JSON.parse(_);if(r.v!==1)return null;const n=q();for(const t of Ir)typeof r[t]=="string"&&(n[t]=dr(r[t],n[t].length));return n.labels=n.labels.map((t,e)=>typeof r[`labels${e}`]=="string"?dr(r[`labels${e}`],t.length):t),n.magic=Number(r.magic)>>>0,n.identityName=String(r.identityName??""),n.defaultLayer=Number(r.defaultLayer)||0,n.storageFlags=Number(r.storageFlags)||0,n}catch{return null}}function Nr(){try{return typeof localStorage>"u"?null:localStorage}catch{return null}}function an(){const _=Nr()?.getItem(Kr);return _?sn(_):null}function Rr(_){try{Nr()?.setItem(Kr,_n(_))}catch(r){console.warn("[fake board] Could not save the simulated board's settings:",r)}}function Cn(){try{Nr()?.removeItem(Kr)}catch{}}const Dr=[{name:"quick tap",ms:90,fingers:1,x:1500,y:1700,dx:15,dy:10,gap:900},{name:"tap that rolls 0.6 mm at the lift",ms:120,fingers:1,x:2400,y:2100,dx:50,dy:35,late:40,gap:1100},{name:"slow touch, too long for a tap",ms:280,fingers:1,x:2e3,y:1500,dx:10,dy:15,gap:1e3},{name:"press and hold",ms:1100,fingers:1,x:1800,y:2300,dx:30,dy:20,gap:1100},{name:"hold that drifts 0.65 mm",ms:700,fingers:1,x:2600,y:1600,dx:45,dy:47,by:400,gap:1100},{name:"two-finger tap",ms:110,fingers:2,x:1300,y:2e3,dx:10,dy:0,others:[{ox:1600,oy:-150}],gap:1100},{name:"two-finger scroll",ms:700,fingers:2,x:1300,y:1200,dx:0,dy:900,others:[{ox:1700,oy:-100,delay:40}],gap:1100},{name:"two fingers that move 0.6 mm, too little to scroll",ms:450,fingers:2,x:1400,y:1800,dx:40,dy:45,others:[{ox:1600,oy:120,delay:30}],gap:1e3},{name:"three-finger touch",ms:500,fingers:3,x:800,y:2e3,dx:20,dy:10,others:[{ox:1500,oy:-250,delay:30},{ox:3e3,oy:50,delay:60}],gap:1e3},{name:"resting palm",ms:900,fingers:1,x:2700,y:2700,dx:80,dy:-40,area:14,gap:1100},{name:"pointer move",ms:600,fingers:1,x:1e3,y:2600,dx:1800,dy:-700,gap:1400}],Q=Dr.reduce((_,r)=>_+r.ms+r.gap,0);function J(_){const r=Math.sin(_*12.9898)*43758.5453;return(r-Math.floor(r))*2-1}function Kn(_){let r=0;for(const[n,t]of Dr.entries()){if(_<r+t.ms){const e=_-r,s=Math.min(1,t.late?Math.max(0,(e-(t.ms-t.late))/(t.late-10)):e/((t.by??t.ms)-10)),o=6*J(n*1e3+Math.floor(e/10)),i=Math.min(1,(e+10)/(t.area?150:60)),a=Math.round((420+380*i)*(1+.05*J(n*7+Math.floor(e/30)))),C=t.area??(t.fingers>1?4:3),K=Math.max(1,Math.round(C*i)),O=Math.round(t.x+t.dx*s+o),b=Math.round(t.y+t.dy*s-o),A=[{slot:0,x:O,y:b,area:K}];for(const[v,k]of(t.others??[]).entries()){if(e<(k.delay??0))continue;const w=5*J(n*1e3+97*(v+1)+Math.floor(e/10)),X=Math.min(1,(e-(k.delay??0)+10)/60);A.push({slot:v+1,x:O+k.ox+Math.round(w),y:b+k.oy-Math.round(w),area:Math.max(1,Math.round((k.area??4)*X))})}return{t:_,x:O,y:b,fingers:A.length,strength:a,area:K,points:A}}if(r+=t.ms+t.gap,_<r)return{t:_,x:t.x+t.dx,y:t.y+t.dy,fingers:0,points:[]}}return{t:_,x:0,y:0,fingers:0,points:[]}}const Nn="XQAAAAT//////////wA9iInGVDbDF0/k5i20IEFAa6A1i4aNevXOOFOphT5cHOBLs5Do+nG6zZaqdPbnO+mNn7UIYXy944A8HRv5tFUVIGyb3lx+r69MT1djAEMSfS2iX2smOIwlDBAof+6NyY3seBQV/iouN20AQYhFBVtp7ElXSYjDFB2UVn8C3lO2ynN8H+NM5rHbfpWonnz1s2FXh5dyX98GwYRVJVdrO3auZdeT+b6eYIe8Q/UlNxOmzR8+DbPJXpwtBr9IQ9n6jU9y6cOjaMy56ck/TRLodroMFXhvAktki6gyzDBNU9+slSldP9XY6C+vwdLe9D80qZjyPNRl6Oe3MC1w+Fusu3HhXBuWNTxkiPMHmMLvjJGkyk+Nzx95HXuHPOmoHqXZnKe9m1muckGsuEwHx7DLjo5Rf02aatb9+pIuy9LQCKPEeaWPSjqSttiUL6UmdJU3s+/VZpJocqijZxM1xSCbgOVT8DbOTZGfMSuTmM/zIkSoAjXUanGtmFIS5wRXsxSNnCLQNcddAr4zszFwaADIjQ5u9TDouS7ctxtdsi+LJiaqKdYIpbju+RybqvgwvfCnpWDUNBX+Hkpiyhu3yMKbZ3ByWqiCIf/4QtZymGPbGdjQDmlE0M1EYCDPsj4mdaV+AytZzohNe2XJ9IegwoeS7lNgZ66aNcxxpRytZdVVrAMXVpfxIDxdOdxqclQGg6F2s3ig+xQAgZBhak5pT688unB/V8PoR8IuxNbXsvCnxOZKVpmsEAV6bbgZztcPcQfpOE5wv7qFgPhE3UUpYTC2uJ23pDXkrT/6oS7fgkxbHoxkJ0kb+3lEDO5KdWj0O2nG2A034NQCILzy107yUSSz/uRhHR3ctue+VOprUDrC7RdZG9wqTBb5G1JjB5bc1cxZ7bGW3g2tLsQ7bdo7wpmV/CQxwT/t+V6LBaJ2BA3ZHzf32rrWDg6aTjw0CZeLlMLp/qYMoYaZuifQSeKCcJQSrtosUAKgWAd1dUqtwi6/pay1Al3LJS0vuPhE90XvD/FUSAO1dA8DP4zbwc3IjOevUOCC/e7hR/aGaszQklMnfgn2XtEcWAe5hRVE1erfyi9EDkJIW+8GPiWD+V1fmEvJGMiuTuo8glAbrz0HkZIPXXs6/Bm1gaHyoJr1osO+V8Ocw/L3LGIT4voV1oXQUmhnXkHu0PG/sOIhyX1c31es5vDIndUAtje4tUkgH7E513+A/Sr+WVY7QA6bc8nrY8bz/cawv1zuwSf9DoCvGUaHoMNJnmAPlufCJPxZfky2WeH/xEUcQ7h/bOTRMqxrY+TV7vvGXvAz2rXs6XfxC7wtVnIRaPY1WqwelkGdOBzIeXnmzt9zuKxxoG8ADFWuIVMU+YfmbQVxI/7LI7h0pUXT4pDHkpoaMS7oLfpqUZ8VQTkwDysNrMuMCs5ebhHURNwwV7PMZu8F1TL7Aw/TqdPCxWKaaJBYFheybnvoF0NpGNL91Wu8+yA9ghD/rNOCEwFawN2NVgpAGpTANjlxFz/8OpwjAJCqb3rWOhcovDLY+CCIE5ZdORpilEWIkAETicLWP2fqbyHkPRMYs5SL2hKQTRHOeIzpshGeJjdmaymfokUER7kslmvwitMzcY2yDdRXDafDXTVSYApO+oip37GB33Qv6V9A8mMvqDdfrxbb0b3NhvexvrRK5yH+FHrYbh4j/pXZjzQVHfQbGA2AeMwadLA5VVKTL2/xdVg+/0LBS651IQIPRIShkLV3WWLm2qwWWV5COq231BsyxKDXtlzZV8KhAX61mEVsi9ugycLFf6dtojpfMOXEznExGQx7NTnf5K/m38WtAvXaGcz22biKHGzyP39EKxjJ/kYWtkhFScSzRhETwheSKulE5/coPDUnmiD4f5ccid5NJjQhxxvk6iWJjfBlcWhsjx+0x+ig3Go5Bjc+lxlPLPzu38d6m8FdadJrO7JY3W4U8C4vfi58nQD8HoTmU3oq5BnFjGCRbT0+cZX+5bBp/ZVSb9NOYiG/elRGy4uAo76Z9KbIIs5e++CC+yNpH36ENSKovzSNUSsONVckBbV19EtAFANTnrTM4tI+MQg/iC6awLee04LH7ICZZMKXUepQFGF9zUiYM1gU1DBYE29hyI6onegbYFOr8vbx40VN5asdC1KDvgVU7lMYXb8rYrde3iI2AICu+vLXjPB7vZtBFwCkYLTuq33Ic29un0rCVFwcUF3WIaQ8SsoQog9Cr25g11zoqfYbkSY9PCaEv9H0H5d12MpSZXJJRxaQtOa9RzNEy0ugq2+2gMAGuQkCqn2ZNaAr8Qbj4yw9Z+bLOXzj4/qbaG1X4KVyWXpdRsRbh+Iu4F4eWqqnQUh51SUB38R2mceaQK0YzIjSxAwfCrVeeDghXvX1hNeOCC97hT69FCEZ4AA66tjdvVNpQkmzf0WOxTLoE3VKVLG2y2pJ0jsirkmQbjiZ/Y/tK8o6fClt8/eJeaue8Lx43O+ELB8Vw8BUM011IrUzpx0/03EwVShQ7QVt07Xl6sAOIYwnTsh44RdDmpJr80k/yuaoKXahuUdsGWGlVloD+2t/OLSqFgtUJIcrMYj8/szwB3UrWS/ZG7vTRbQ3VK5iHeo6kixod4bmNHfWzVTM6wOdj0a9Ynvy0vpcG9u2gvqL5NYoczk7RRp+U+R7r008TkK5rmeEX95ZWo0mEahyi20ZeRWYyWwuJnkAi5gIVsJJI8cI9dcT/Sdrjb41TIdGt06yvhJ+/5jraPY97KEG5PpzOehwNVZ/KaSv02dLZgqmg/OE2OCyS6BnpxQpq/nvCcGpo2zFcH2m6IUk7TXhJ+WF5t3+0QEmeXn0P7DnC779SidYqxpLTO5gYdXw4oGw4nVt/HxbfmFBKlCjdrW5fFLciBfW1RGvDobZkocfOjto5OtuTHAfY497WrMoaE44EWcRiJCk51K6r49Ol99oAL/kKuw90rfvKZI9jqVO5jvvg6GhpZ7m+WJ2UQu5dhG2d5b5sq+pcDdFnt1WnTK6ACrIGKwiyvTKfGuvpxkCJrUvjAuSH09TOngaN+VERMTuGjFo3wTNGG4sd/1iuORe+KJboSjCeDjxybHCFyG+Tro9bT8AWBGaBxzhsIquh1QeIYOLDQkAgDU+9IQ09EccXSvwhghinfRJXXUqZHNEZz9FMnLdWVKulQ+4VSwuMS3AbDZdzZj0YEItFLC4JDF+M8R6ddL2RIM8IcbVTdHu84ReKdHqqn4kPYbXbJGtOxGB0eEnCzQfeK0zmE3snEVEc5Fr6uxPFt/ezLR1XbwdAlemb9kK+BR5kMfAFzY9BnVwyHsmJ7ahNT1oTjRJINCQ1BtEcOPIMZQMiJjXTdvmtpLEaMHMosvXlwSxjccIYsra731q9+25aBxsOnlvNZRbDI9ibNqfiJ8iZ/C3ZawhnlBYK2/VEFUi92TlszHRZ3v/FBOBgG+fdosvC4fheNHh7d7gb8QcCEjzbIu+Km0nFcbwCpQenW06iPrNMKB0INh6/QZ6ng0NjKoivQQC9sYGEOZqYlry6as65r+keOv7zgX/vKvc8A==";function cn(_){const r=atob(_),n=new Uint8Array(r.length);for(let t=0;t<r.length;t++)n[t]=r.charCodeAt(t);return n}const P=cn(Nn);function ln(_){let r=0;const n=[];return Br.decompressFile({readByte:()=>r<_.length?_[r++]:-1},{writeByte:t=>{n.push(t)}}),new TextDecoder().decode(new Uint8Array(n))}const Y=JSON.parse(ln(P)),vr=Y.composition?.instances??[],D=vr.length,un=vr.flatMap((_,r)=>_.hardware_detect?[r]:[]),Sn=Y.fragments?.pointing_none?.id??255,pn=Y.fragments?.pointing_touchpad_azoteq?.id??7,$=221,rr=223,mr=254,dn=4294967295,Tn=1,Rn=3,Or=120,mn=6,On=3,p=255,hr=22,hn=[27,24,125,242,33,246,41,72],U=[0,0,9],fn=75,gn=15,yn=128,bn=4,kn=8,wn=16,xn=32,En=64,An=128,Ln=1,Mn=2,In=4,G=105,F=[300,20,50,100,150,200,250,350,400,500,600,700,800,1e3,1200,1500],L=6,z=5,nr=1500,Dn=500,fr=13,M=255,vn=2,Fn=73,Pn=83,er=24,gr=5,m=[90,60,45,30,25,20,15],h=9,Un=48,x=5,T=49,sr=50,H=[200,300,400,500,800],I=5,Bn=84,V=64,qn=[83,86,65,76,66,79,65,82],N=(_,r)=>_[r]|_[r+1]<<8,W=(_,r)=>(_[r]|_[r+1]<<8|_[r+2]<<16|_[r+3]<<24)>>>0,u=(_,r,n)=>{_[r]=n&255,_[r+1]=n>>8&255},f=(_,r,n)=>{_[r]=n&255,_[r+1]=n>>>8&255,_[r+2]=n>>>16&255,_[r+3]=n>>>24&255},yr={0:{bytes:_=>_.tapDance,size:B,used:_=>!!(N(_,0)||N(_,2)||N(_,4)||N(_,6))},1:{bytes:_=>_.combo,size:ar,used:_=>!!(N(_,0)||N(_,8))},2:{bytes:_=>_.keyOverride,size:Ar,used:_=>!!(N(_,0)||N(_,2))},3:{bytes:_=>_.altRepeatKey,size:Lr,used:_=>!!(N(_,0)||N(_,2))},4:{bytes:_=>_.leader,size:ir,used:_=>!!(N(_,0)||N(_,10))}},Gn={1:{table:0,set:!1,minLength:0},2:{table:0,set:!0,minLength:14},3:{table:1,set:!1,minLength:0},4:{table:1,set:!0,minLength:16},5:{table:2,set:!1,minLength:0},6:{table:2,set:!0,minLength:16},7:{table:3,set:!1,minLength:0},8:{table:3,set:!0,minLength:10},20:{table:4,set:!1,minLength:0},21:{table:4,set:!0,minLength:18}},tr=[{qsid:1,size:1,offset:26,bit:0},{qsid:2,size:2,offset:22,bit:0},{qsid:5,size:1,offset:28,bit:0},{qsid:6,size:2,offset:2,bit:0},{qsid:7,size:2,offset:24,bit:0},{qsid:9,size:2,offset:4,bit:0},{qsid:10,size:2,offset:6,bit:0},{qsid:11,size:2,offset:8,bit:0},{qsid:12,size:2,offset:10,bit:0},{qsid:13,size:2,offset:12,bit:0},{qsid:14,size:2,offset:14,bit:0},{qsid:15,size:2,offset:16,bit:0},{qsid:16,size:2,offset:18,bit:0},{qsid:17,size:2,offset:20,bit:0},{qsid:18,size:2,offset:30,bit:0},{qsid:19,size:2,offset:32,bit:0},{qsid:20,size:1,offset:34,bit:0},{qsid:21,size:0,offset:0,bit:0},{qsid:22,size:1,offset:29,bit:0},{qsid:23,size:1,offset:29,bit:1},{qsid:24,size:1,offset:29,bit:2},{qsid:25,size:2,offset:36,bit:0},{qsid:26,size:1,offset:29,bit:3},{qsid:27,size:2,offset:38,bit:0},{qsid:28,size:2,offset:40,bit:0},{qsid:29,size:1,offset:42,bit:0}],br=_=>_>=22&&_<=26&&_!==25||_===29,kr=new Set([6,13,14,20,21,22,23,24,T]),zn=_=>_<=15||_>=20&&_<=31||_>=32&&_<48,Vn=_=>_<=14||_>=20&&_<=30||_>=32&&_<48,Wn=new Set([T,sr]),wr=_=>H.reduce((r,n,t)=>Math.abs(n-_)<Math.abs(H[r]-_)?t:r,0);class Zn{constructor(r,n={}){this.state=r,this.comboLabels=n.comboLabels??!0,this.unread=n.unread,this.typingPause=n.typingPause??!0,this.flickerLatch=n.flickerLatch??!0,this.debugConsole=n.debugConsole??!0,this.debounceSwitch=n.debounceSwitch??!0,this.timingUsOnly=n.timingUsOnly??!0,this.padGestures=n.padGestures??!0,this.touchpad=n.touchpad??!1,this.hostTouchpad=n.hostTouchpad??!1,this.multiFinger=n.multiFinger??!0,this.onChange=n.onChange,this.timingUsOnly&&this.migrateTiming(),this.factoryKeymap=n.factoryKeymap,this.serial=n.serial??qn;const t=Date.now();this.now=n.now??(()=>Date.now()-t),this.idCounter=Math.floor(Math.random()*65536)}comboLabels;typingPause;flickerLatch;debugConsole;debugEnable=!1;debugRequests=[];debounceSwitch;timingUsOnly;padGestures;touchpad;hostTouchpad;multiFinger;leftMissing=!1;padMode=0;invalidFrameEvery=0;leftOsDropEvery=0;touchReads=0;fingersReads=0;get padsOs(){return this.hostTouchpad&&this.padMode===0}padPalm=0;padSetting=0;padTuning={deadZone:lr[0],tapMs:cr[0],scroll:0};padPlayers=null;touchSpeed=1;customWrites=[];opticalDebounceOn=!0;debounceWrites=[];pressed=new Set;latchPressed=new Uint8Array(S);latchReleased=new Uint8Array(S);changes=new Uint8Array(S*L);latchReads=0;pauseRequests=[];pauseOwner=0;pauseOwnerSeen=0;pauseEndedAt=null;pausePaused=!1;pauseLastEnd=0;currentClient=0;layerState=0;dropKeymapWrites=0;idCounter;now;onChange;factoryKeymap;serial;stagedName=new Uint8Array(V);unread;migrateTiming(){const r=this.state.custom,n=o=>r[o*2]|r[o*2+1]<<8,t=(o,i)=>{r[o*2]=i&255,r[o*2+1]=i>>8&255};let e=!1;const s=r[h*2]<m.length?r[h*2]:0;for(const o of[13,14])n(o)===0&&(t(o,m[s]),e=!0);if(r[h*2]!==0&&(r[h*2]=0,e=!0),n(T)===0){const o=r[x*2];t(T,o<I?H[o]:500),e=!0}e&&this.changed()}timingPreset(){const r=this.state.custom,n=r[26]|r[27]<<8,t=r[28]|r[29]<<8,e=m.indexOf(n);return n===t&&e>=0?e:255}timingValue(r,n,t){const e=this.state.custom,s=(a,C)=>{e[a*2]=C&255,e[a*2+1]=C>>8&255},o=a=>e[a*2]|e[a*2+1]<<8;if(r===8){if(n===h)t[0]=this.timingPreset();else if(n===T)t[0]=e[T*2],t[1]=e[T*2+1];else if(n===sr)t[0]=e[x*2]===I?1:0;else return!1;return!0}if(r!==7)return!1;const i=t[0]|t[1]<<8;if(n===h)t[0]<m.length&&(s(13,m[t[0]]),s(14,m[t[0]]));else if(n===13||n===14)s(n,i||m[0]);else if(n===x){if(t[0]>I)return!0;e[x*2]=t[0],t[0]<I&&s(T,H[t[0]])}else if(n===T){const a=Math.round(Math.min(2e3,Math.max(100,i))/10)*10;s(T,a),e[x*2]!==I&&(e[x*2]=wr(a))}else if(n===sr)e[x*2]=t[0]?I:wr(o(T)||500);else return!1;return this.changed(),!0}get macroBufferSize(){return this.comboLabels?Jr:Cr}get featureFlags3(){return(this.typingPause?bn:0)|(this.flickerLatch?kn:0)|(this.padGestures?wn:0)|(this.padGestures&&this.touchpad?xn|En|(this.multiFinger?An:0):0)}count(r,n){const t=r*L+n;this.changes[t]<255&&this.changes[t]++}press(r,n){const t=`${r},${n}`;this.pressed.has(t)||(this.pressed.add(t),this.latchPressed[r]|=1<<n,this.count(r,n))}release(r,n){const t=`${r},${n}`;this.pressed.has(t)&&(this.pressed.delete(t),this.latchReleased[r]|=1<<n,this.count(r,n))}flicker(r,n){this.press(r,n),this.release(r,n)}rawRow(r){let n=0;for(let t=0;t<8;t++)this.pressed.has(`${r},${t}`)&&(n|=1<<t);return n}flickerCommand(r,n){if(n<4+3*S||n<4+z*L){n>1&&(r[1]=3);return}const t=r[0],e=r[1];if(r.fill(0,1,n),t===0){this.latchReads++,r[2]=3,r[3]=S;for(let s=0;s<S;s++)r[4+s]=this.rawRow(s),r[4+S+s]=this.latchPressed[s],r[4+2*S+s]=this.latchReleased[s];this.latchPressed.fill(0),this.latchReleased.fill(0)}else if(t===1&&e<=1){r[2]=1,r[3]=e;const s=e*z*L;r.set(this.changes.subarray(s,s+z*L),4),this.changes.fill(0,s,s+z*L)}else r[1]=1}typingPauseState(){const r=this.timer();return this.pausePaused&&r-this.pauseOwnerSeen>=nr&&(this.pausePaused=!1,this.pauseEndedAt=this.pauseOwnerSeen+nr,this.pauseLastEnd=2),this.pausePaused?"paused":this.pauseEndedAt!==null&&r-this.pauseEndedAt<Dn?"ending":(this.pauseEndedAt=null,"off")}typingPauseCommand(r,n){if(n<16){n>1&&(r[1]=3);return}const t=r[0];this.pauseRequests.push({op:t,client:this.currentClient,at:this.timer()}),this.pauseRequests.length>2e3&&this.pauseRequests.splice(0,this.pauseRequests.length-2e3),r.fill(0,1,n);let e=0;const s=this.typingPauseState();t===1?(this.pausePaused=!0,this.pauseEndedAt=null,this.pauseOwner=this.currentClient,this.pauseOwnerSeen=this.timer()):t===0?s==="paused"&&(this.pausePaused=!1,this.pauseEndedAt=this.timer(),this.pauseLastEnd=1):t!==2&&(e=1);const o=this.typingPauseState();r[1]=e,r[2]=o==="paused"?1:o==="ending"?2:0,r[3]=this.pauseLastEnd,r[4]=o!=="off"&&this.pauseOwner===this.currentClient?1:0,u(r,5,o==="paused"?Math.max(0,nr-(this.timer()-this.pauseOwnerSeen)):0)}get featureFlags2(){return gn|(this.comboLabels?yn:0)}changed(){this.onChange?.(this.state)}receive(r){const n=r.length,t=new Uint8Array(r);return t[0]===$?this.clientWrapperReceive(t,n):t[0]===rr?null:(this.viaReceive(t,n,!1),t)}timer(){return Math.floor(this.now())>>>0}allocateId(){const r=(this.timer()&4294901760|this.idCounter&65535)>>>0;return this.idCounter=this.idCounter+1&65535,r}validId(r){if(r===0||r===dn)return!1;const n=(r&4294901760)>>>0;return((this.timer()&4294901760)>>>0)-n>>>0<Or*1e3}sendError(r,n,t){return t.fill(0),t[0]=$,f(t,1,r),t[5]=255,t[6]=n,t}clientWrapperReceive(r,n){const t=W(r,1);if(t===0)return n<31?null:(f(r,25,this.allocateId()),u(r,29,Or),r);if(!this.validId(t))return this.sendError(t,Tn,r);this.currentClient=t,this.typingPauseState()==="paused"&&t===this.pauseOwner&&(this.pauseOwnerSeen=this.timer());const e=r[5];return e===rr&&this.unread?.qmkSettings&&(r[6]===16||r[6]===17)||e===mr&&r[6]===8&&r[7]===0&&this.unread?.customIds?.includes(r[8])?null:e===rr?(this.svalCommand(r.subarray(5),n-5),r):e===mr?(r.copyWithin(0,6),this.viaReceive(r,n,!0),r.copyWithin(6,0,n-6),r[0]=$,f(r,1,t),r[5]=e,r):this.sendError(t,Rn,r)}viaBufferSize(r,n,t){const e=t&&n>6?n-6:n,s=e>4?e-4:0;return r>s?s:r}viaReceive(r,n,t){const e=r.subarray(1),s=this.state;switch(r[0]){case 1:e[0]=fr>>8,e[1]=fr&255;break;case 2:switch(e[0]){case 1:{const o=this.timer();e[1]=o>>>24&255,e[2]=o>>>16&255,e[3]=o>>>8&255,e[4]=o&255;break}case 2:case 4:e[1]=e[2]=e[3]=e[4]=0;break;case 3:{const o=e[1];let i=2;for(let a=0;a<28&&a+o<S;a++){let C=0;for(let K=0;K<8;K++)this.pressed.has(`${a+o},${K}`)&&(C|=1<<K);e[i++]=C}break}case 6:e[1]=0,e[2]=0,e[3]=0,e[4]=U[2];break;default:r[0]=M}break;case 3:e[0]!==2&&e[0]!==5&&(r[0]=M);break;case 4:{const o=this.keycodeAt(e[0],e[1],e[2]);e[3]=o>>8,e[4]=o&255;break}case 5:{const[o,i,a]=[e[0],e[1],e[2]];if(this.dropKeymapWrites>0){this.dropKeymapWrites--;break}if(o<y&&i<S&&a<g){const C=((o*S+i)*g+a)*2;s.keymap[C]=e[3],s.keymap[C+1]=e[4],this.changed()}break}case 6:if(!this.factoryKeymap){r[0]=M;break}s.keymap.set(this.factoryKeymap),this.changed();break;case 7:case 8:case 9:this.customValueCommand(r,n,t);break;case 12:e[0]=or&255,e[1]=or>>8;break;case 13:{const o=Math.min(this.macroBufferSize,65535);e[0]=o>>8,e[1]=o&255;break}case 14:case 15:{const o=e[0]<<8|e[1],i=this.viaBufferSize(e[2],n,t);r[0]===14?this.macroRead(o,i,e.subarray(3)):(this.macroWrite(o,e.subarray(3,3+i)),this.changed());break}case 16:s.macros.fill(0),this.changed();break;case 17:e[0]=y;break;case 18:case 19:{const o=e[0]<<8|e[1],i=this.viaBufferSize(e[2],n,t),a=e.subarray(3);if(r[0]===19&&this.dropKeymapWrites>0){this.dropKeymapWrites--;break}for(let C=0;C<i;C++){const K=o+C;r[0]===18?a[C]=K<s.keymap.length?s.keymap[K]:0:K<s.keymap.length&&(s.keymap[K]=a[C])}r[0]===19&&this.changed();break}default:r[0]=M}}keycodeAt(r,n,t){if(r>=y||n>=S||t>=g)return 0;const e=((r*S+n)*g+t)*2;return this.state.keymap[e]<<8|this.state.keymap[e+1]}macroRead(r,n,t){const e=this.macroBufferSize;for(let s=0;s<n;s++)t[s]=r<e&&s<e-r?this.state.macros[r+s]:0}macroWrite(r,n){const t=this.macroBufferSize;for(let e=0;e<n.length;e++)r<t&&e<t-r&&(this.state.macros[r+e]=n[e])}customValueCommand(r,n,t){const[e,s,o]=[r[0],r[1],r[2]],i=r.subarray(3);if(s===vn){this.rgblightCommand(r);return}if(s===Bn){r[0]=M;return}if(s===Pn){this.scanlabCommand(r,n);return}if(s===Fn){this.identityCommand(r,n,t);return}const a=this.state.custom;if(o===Un&&this.debounceSwitch){e===7?(this.opticalDebounceOn=i[0]!==0,this.debounceWrites.push({value:i[0],saved:!1})):e===8&&(i[0]=this.opticalDebounceOn?1:0);return}if(this.padGestures&&this.touchpad&&this.multiFinger&&o===59){e===7?(this.customWrites.push({id:o,value:Array.from(i.subarray(0,2))}),this.padMode=i[0]===1?1:0):e===8&&(i[0]=this.padMode);return}if(this.padGestures&&this.touchpad&&this.multiFinger&&o===58){e===7?(this.customWrites.push({id:o,value:Array.from(i.subarray(0,2))}),this.padPalm=Math.min(56,i[0]|i[1]<<8)):e===8&&(i[0]=this.padPalm,i[1]=0);return}if(this.padGestures&&this.touchpad&&o>=55&&o<=57){this.padTuningValue(e,o,i);return}if(this.padGestures&&o>=51&&o<=54){this.padValue(e,o,i);return}if(e===9&&this.debounceWrites.length&&(this.debounceWrites[this.debounceWrites.length-1].saved=!0),e===7&&this.customWrites.push({id:o,value:Array.from(i.subarray(0,2))}),!(this.timingUsOnly&&this.timingValue(e,o,i))&&!(!this.timingUsOnly&&Wn.has(o))){if(e===7){if(o>=_r||!Vn(o))return;let C=i[0];if((o===0||o===2)&&C>=11||o===5&&C>=6||o===9&&C>=7)return;o===30&&C>2&&(C=2),o>=25&&o<=29&&(C=C?1:0),a[o*2]=C,(kr.has(o)||o>=32)&&(a[o*2+1]=i[1]),this.changed()}else if(e===8){if(o>=_r||!zn(o))return;i[0]=a[o*2],(kr.has(o)||o===31||o>=32)&&(i[1]=a[o*2+1])}}}padTuningValue(r,n,t){const e=this.padTuning;if(r===7){this.customWrites.push({id:n,value:Array.from(t.subarray(0,2))});const s=t[0]|t[1]<<8;n===55?e.deadZone=j(lr,s):n===56?e.tapMs=j(cr,s):e.scroll=s===0||s===G?0:j(Vr.slice(1),s)}else if(r===8){const s=n===55?e.deadZone:n===56?e.tapMs:e.scroll||G;t[0]=s&255,t[1]=s>>8}}chipSettings(){const r=this.padSetting;return{deadZone:this.padTuning.deadZone,tapMs:this.padTuning.tapMs,holdMs:F[r>>3&15],tapOn:(r&1)===0,twoFingerOn:(r&2)===0,holdOn:(r&4)===0,scrollStart:this.padTuning.scroll||G}}padModels(r){return this.padPlayers||(this.padPlayers=[0,Q/2].map(n=>({model:new qr(()=>this.chipSettings()),fedTo:r,offset:n}))),this.padPlayers.map(n=>{for(let t=Math.max(n.fedTo,r-Q);t<=r;t+=10){const e=(t+n.offset)%Q;n.model.sample({...Kn(e),t})}return n.fedTo=Math.max(n.fedTo,r+10),n.model})}fingersPage(r){const n=this.now()*this.touchSpeed,[t,e]=this.padModels(n).map((s,o)=>({...s.readFingers(n),os:this.padsOs,...this.leftMissing&&o===0?{valid:!1}:{}}));r.set(Gr({palm:this.padPalm,left:t,right:e}))}touchPage(r){const n=this.now()*this.touchSpeed;this.touchReads++;const t=this.invalidFrameEvery>0&&this.touchReads%this.invalidFrameEvery===0,e=this.leftOsDropEvery>0&&this.touchReads%this.leftOsDropEvery===1,s=this.padModels(n).map((i,a)=>({...i.read(n),os:this.padsOs&&!(a===0&&e),...t||this.leftMissing&&a===0?{valid:!1}:{}})),o=this.chipSettings();r.set(zr({tapOn:o.tapOn,twoFingerOn:o.twoFingerOn,holdOn:o.holdOn,elapsedMs:0,deadZone:o.deadZone,tapMs:o.tapMs,holdMs:o.holdMs,width:Wr,height:Zr,channelsX:8,channelsY:7,scrollStart:this.padTuning.scroll||G,left:s[0],right:s[1]}))}padValue(r,n,t){const e=n===51?1:n===52?2:4;if(r===7)if(this.customWrites.push({id:n,value:Array.from(t.subarray(0,2))}),n===54){const s=t[0]|t[1]<<8,o=F.reduce((i,a,C)=>{const K=Math.abs(a-s),O=Math.abs(F[i]-s);return K<O||K===O&&a<F[i]?C:i},0);this.padSetting=this.padSetting&-121|o<<3}else this.padSetting=t[0]?this.padSetting&~e:this.padSetting|e;else if(r===8)if(n===54){const s=F[this.padSetting>>3&15];t[0]=s&255,t[1]=s>>8}else t[0]=this.padSetting&e?0:1}scanlabCommand(r,n){const[t,,e]=[r[0],r[1],r[2]],s=r.subarray(3);if(t!==7&&t!==8)return;const o=t===8?e&-9:e,i=t===8?e>>3&1:s[0]&1,a=new Uint8Array(er),C=this.state.custom,K=w=>C[w*2]|C[w*2+1]<<8,O=C[h*2]<m.length?C[h*2]:0,b=K(13)||m[O],A=K(14)||m[O],v=[25,26,27,28,29].reduce((w,X,Ur)=>w|(C[X*2]?1:0)<<Ur,0);o===16?(a[0]=1,u(a,8,b),u(a,10,A),a[12]=i===0?1:0,a[13]=4,u(a,17,K(13)),u(a,19,K(14)),a[21]=this.timingUsOnly?this.timingPreset():C[h*2],a[22]=i===1?1:0,this.debounceSwitch&&(a[23]=1|(this.opticalDebounceOn?2:0))):o===17?(u(a,0,K(20)),u(a,2,K(21)),u(a,4,K(22)),u(a,6,1e3),u(a,8,gr*(b+13)),u(a,11,K(20)),u(a,13,b),u(a,15,A),a[17]=gr,u(a,18,K(23)),u(a,20,K(24)),a[22]=(v&31)<<2):o===18&&(a[0]=v,a[5]=this.state.rgb[0],a[4]=this.state.rgb[0],a[7]=1,a[21]=125,a[22]=[48,24,12][Math.min(2,C[60])]);const k=Math.min(Math.max(0,n-3),this.debounceSwitch?er:er-1);s.set(a.subarray(0,k))}rgblightCommand(r){const[n,,t]=[r[0],r[1],r[2]],e=r.subarray(3),s=this.state.rgb;if(n===9)return;const i={1:[0],2:[1],3:[2],4:[3,4]}[t];if(!i){r[0]=M;return}n===7?(i.forEach((a,C)=>{s[a]=e[C]}),this.changed()):i.forEach((a,C)=>{e[C]=s[a]})}identityCommand(r,n,t){const[e,,s]=[r[0],r[1],r[2]],o=r.subarray(3);if(n<16)return;const i=n-5-(t?mn:0),a=new TextEncoder().encode(this.state.identityName);if(e===8&&s===0)o[0]=1,o[1]=1,o[2]=a.length,o[3]=V,o[4]=2,o.set(this.serial,5);else if(e===8&&s===1){const C=o[0],K=C<a.length?Math.min(i,a.length-C):0;o[0]=0,o[1]=K,o.set(a.subarray(C,C+K),2)}else if(e===7&&s===1){const[C,K]=[o[0],o[1]];if(K>i||C+K>V){o[0]=1;return}this.stagedName.set(o.subarray(2,2+K),C),o[0]=0}else if(e===7&&s===2){const C=o[0];if(C>V){o[0]=1;return}this.state.identityName=new TextDecoder().decode(this.stagedName.subarray(0,C)),this.changed(),o[0]=0}else e===7&&s===3?o[0]=0:o[0]=1}svalCommand(r,n){const t=r[1],e=this.state,s=Gn[t];if(s){this.tableCommand(r,n,s.table,s.set,s.minLength);return}switch(t){case 0:{f(r,2,On),r.set(hn,6),r[14]=fn,r[15]=U[0],r[16]=U[1],r[17]=U[2],r[18]=e.storageFlags&5,r[19]=this.featureFlags2,n>20&&(r[20]=this.featureFlags3),n>21&&(r[21]=(this.padGestures&&this.touchpad&&this.multiFinger?Ln|Mn:0)|(this.debugConsole?In:0));break}case 42:e.storageFlags&&(e.storageFlags=0,this.changed());break;case 9:{r[2]=e.qmkSettings[2],r[3]=e.qmkSettings[3],r[4]=e.qmkSettings[28];break}case 10:e.qmkSettings[2]=r[2],e.qmkSettings[3]=r[3],e.qmkSettings[28]=r[4],this.changed();break;case 11:break;case 12:this.reset();break;case 13:f(r,2,P.length);break;case 14:{const o=N(r,2);let i=r[4];if((i===0||i>hr)&&(i=hr),o>=P.length){r[4]=0;break}const a=Math.min(i,P.length-o);r.set(P.subarray(o,o+a),5),r[4]=a;break}case 16:{const o=N(r,2),i=r.subarray(2,n);i.fill(255);let a=0;for(const C of tr)if(C.qsid>o){if(a+4>i.length)break;u(i,a,C.qsid),a+=2}break}case 17:r[2]=this.qmkSettingsGet(N(r,2),r.subarray(3,n));break;case 18:r[2]=this.qmkSettingsSet(N(r,2),r.subarray(4,n));break;case 19:{const o=q();e.qmkSettings=o.qmkSettings,e.magic=o.magic,this.changed();break}case 22:{if(n<10){r[1]=p;break}f(r,2,this.layerState),f(r,6,1<<e.defaultLayer>>>0),n>=12&&(r[10]=0,r[11]=0);break}case 23:this.layerState=W(r,2);break;case 43:{if(n<3){r[1]=p;break}const o=r[2];if(o>=y){r[2]=1;break}e.defaultLayer=o,this.changed(),r[2]=0;break}case 44:if(n>2){const o=r.subarray(2,n);if(o.fill(0),o.length>=11)if(o[0]=1,this.touchpad){const i=this.padsOs?16:0;o.set([13|i,5,5,0,40],1),o.set([15|i,5,5,0,40],6)}else o.set([9,0,3,0,0],1),o.set([11,0,3,0,0],6)}break;case 45:{const o=n>3?r[3]:0;n>2&&r.subarray(2,n).fill(0),o===1&&this.padGestures&&this.touchpad&&n>=58&&this.touchPage(r.subarray(2,n)),o===2&&this.padGestures&&this.touchpad&&this.multiFinger&&n>=58&&(this.fingersReads++,this.fingersPage(r.subarray(2,n)));break}case 47:n>2&&r.subarray(2,n).fill(0);break;case 24:{r[2]=D;for(let o=0;o<Z;o++)r[3+o]=un.includes(o)?this.touchpad?pn:Sn:255;break}case 25:r[2]=D;for(let o=0;o<Z;o++)r[3+o]=o<D?e.fragments[o]:255;break;case 26:{if(n<24){r[2]=1;break}let o=r[2];if(o>Z){r[2]=2;break}o>D&&(o=D);for(let i=0;i<o;i++)e.fragments[i]=r[3+i];this.changed(),r[2]=0;break}case 33:this.tableScan(r);break;case 30:f(r,2,this.macroBufferSize);break;case 31:case 32:{if(n<7){r[1]=p;break}const o=W(r,2),i=r[6],a=this.macroBufferSize;if(i>n-7||o>a||i>a-o){t===31?r[6]=0:r[2]=1;break}t===31?this.macroRead(o,i,r.subarray(7)):(this.macroWrite(o,r.subarray(7,7+i)),this.changed(),r[2]=0);break}case 27:this.labelGet(r,n);break;case 28:this.labelSet(r,n);break;case 29:this.labelClear(r,n);break;case 61:if(!this.flickerLatch){r[1]=p;break}n>3&&this.flickerCommand(r.subarray(2),n-2);break;case 62:if(!this.debugConsole){r[1]=p;break}if(n>4){const o=r[2];this.debugRequests.push(o),(o===0||o===1)&&(this.debugEnable=o===1),r[3]=o<=2?0:1,r[4]=this.debugEnable?1:0}break;case 60:if(!this.typingPause){r[1]=p;break}n>3&&this.typingPauseCommand(r.subarray(2),n-2);break;default:r[1]=p}}tableCommand(r,n,t,e,s){const o=yr[t],i=o.bytes(this.state),a=N(r,2);if(!e){const C=r.subarray(4,4+o.size);C.fill(0),a<d&&C.set(i.subarray(a*o.size,(a+1)*o.size));return}if(n<s){r[1]=p;return}if(a>=d){r[2]=1;return}i.set(r.subarray(4,4+o.size),a*o.size),this.changed(),r[2]=0}tableScan(r){const n=r[2],t=yr[n];let e=N(r,3),s=!1;const o=new Uint8Array(ir);for(;o.fill(0),!(!t||e>=d);e++)if(o.set(t.bytes(this.state).subarray(e*t.size,(e+1)*t.size)),t.used(o)){s=!0;break}r[3]=s?1:0,r[4]=e&255,r[5]=e>>8&255,s&&r.set(o,6)}labelArray(r){return r===Mr&&!this.comboLabels?null:this.state.labels[r]??null}labelGet(r,n){if(n<6+c){r[1]=p;return}const t=this.labelArray(r[2]);if(!t){r[1]=p;return}const e=t.length/c;let s=N(r,3);const o=i=>t.subarray(i*c,(i+1)*c).every(a=>a===0);for(;s<e&&o(s);)s++;r[3]=s<e?1:0,r[4]=s&255,r[5]=s>>8&255,r.subarray(6,6+c).fill(0),s<e&&r.set(t.subarray(s*c,(s+1)*c),6)}labelStatus(r,n){const t=this.labelArray(r);return t?n>=t.length/c?2:0:1}labelSet(r,n){if(n<5+c){r[1]=p;return}const t=r[2],e=N(r,3),s=r.slice(5,5+c);if(!Hn(s)){r[2]=3;return}const o=this.labelStatus(t,e);o===0&&(this.labelArray(t).set(s,e*c),this.changed()),r[2]=o}labelClear(r,n){if(n<5){r[1]=p;return}const t=r[2],e=N(r,3),s=this.labelStatus(t,e);s===0&&(this.labelArray(t).fill(0,e*c,(e+1)*c),this.changed()),r[2]=s}qmkSettingsGet(r,n){const t=this.state;if(r===21)return n.length<4?255:(f(n,0,t.magic),0);const e=tr.find(s=>s.qsid===r);return e?br(r)?(n[0]=t.qmkSettings[e.offset]>>e.bit&1,0):e.size>n.length?255:(n.set(t.qmkSettings.subarray(e.offset,e.offset+e.size)),0):255}qmkSettingsSet(r,n){const t=this.state;if(r===21)return n.length<4?255:(t.magic=W(n,0)&1023,this.changed(),0);const e=tr.find(s=>s.qsid===r);return e?br(r)?(n[0]?t.qmkSettings[e.offset]|=1<<e.bit:t.qmkSettings[e.offset]&=~(1<<e.bit),this.changed(),0):e.size>n.length?255:(t.qmkSettings.set(n.subarray(0,e.size),e.offset),this.changed(),0):255}firstBootReset(r=4){const n=q();this.factoryKeymap&&n.keymap.set(this.factoryKeymap),n.storageFlags=r,Object.assign(this.state,n),this.changed()}reset(){const r=q(),n=this.state;n.tapDance=r.tapDance,n.combo=r.combo,n.keyOverride=r.keyOverride,n.altRepeatKey=r.altRepeatKey,n.leader=r.leader,n.labels=r.labels,n.fragments=r.fragments,n.macros.fill(0),this.factoryKeymap&&n.keymap.set(this.factoryKeymap),this.changed()}}function Hn(_){let r=!1,n=0;for(;n<c;){const t=_[n];if(t===0){r=!0,n++;continue}if(r||t>=1&&t<=31&&t!==9||t===127)return!1;if(t<=127){n++;continue}let e;if(t>=194&&t<=223)e=1;else if(t>=224&&t<=239)e=2;else if(t>=240&&t<=244)e=3;else return!1;if(n+e>=c)return!1;for(let s=1;s<=e;s++){const o=_[n+s];if(o<128||o>191)return!1}if(t===224&&_[n+1]<160||t===237&&_[n+1]>159||t===240&&_[n+1]<144||t===244&&_[n+1]>143)return!1;n+=1+e}return!0}const Yn=`{\r
  "version": 1,\r
  "uid": 5199957870438586395,\r
  "layout": [\r
    [\r
      [\r
        "KC_LCTRL",\r
        "LGUI_T(KC_TAB)",\r
        "KC_LSHIFT",\r
        "LT1(KC_ENTER)",\r
        "KC_NO",\r
        "KC_CAPSLOCK"\r
      ],\r
      [\r
        "KC_V",\r
        "KC_G",\r
        "KC_F",\r
        "KC_R",\r
        "KC_DQUO",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_C",\r
        "KC_T",\r
        "KC_D",\r
        "KC_E",\r
        "KC_GRAVE",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_X",\r
        "KC_B",\r
        "KC_S",\r
        "KC_W",\r
        "KC_ESCAPE",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_Z",\r
        "KC_LBRACKET",\r
        "KC_A",\r
        "KC_Q",\r
        "KC_DELETE",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_LALT",\r
        "KC_BSPACE",\r
        "MO(1)",\r
        "KC_SPACE",\r
        "KC_NO",\r
        "MO(2)"\r
      ],\r
      [\r
        "KC_M",\r
        "KC_QUOTE",\r
        "KC_J",\r
        "KC_U",\r
        "KC_H",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_COMMA",\r
        "KC_COLN",\r
        "KC_K",\r
        "KC_I",\r
        "KC_Y",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_DOT",\r
        "LT14(KC_NO)",\r
        "KC_L",\r
        "KC_O",\r
        "KC_N",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_SLASH",\r
        "KC_BSLASH",\r
        "KC_SCOLON",\r
        "KC_P",\r
        "KC_RBRACKET",\r
        "KC_NO"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_END",\r
        "KC_5",\r
        "KC_4",\r
        "KC_DLR",\r
        "KC_PERC",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_PGDOWN",\r
        "KC_MINUS",\r
        "KC_3",\r
        "KC_HASH",\r
        "KC_PLUS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_PGUP",\r
        "KC_DOT",\r
        "KC_2",\r
        "KC_AT",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_HOME",\r
        "KC_EQUAL",\r
        "KC_1",\r
        "KC_EXLM",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_LEFT",\r
        "KC_CIRC",\r
        "KC_7",\r
        "KC_AMPR",\r
        "KC_6",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_UP",\r
        "KC_NO",\r
        "KC_8",\r
        "KC_ASTR",\r
        "KC_UNDS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_DOWN",\r
        "KC_NO",\r
        "KC_9",\r
        "KC_LPRN",\r
        "KC_INSERT",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_RIGHT",\r
        "KC_NO",\r
        "KC_0",\r
        "KC_RPRN",\r
        "KC_TILD",\r
        "KC_NO"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_F14",\r
        "KC_F5",\r
        "KC_F4",\r
        "KC_F24",\r
        "KC_F15",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_F13",\r
        "KC_F10",\r
        "KC_F3",\r
        "KC_F23",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_F12",\r
        "KC_NO",\r
        "KC_F2",\r
        "KC_F22",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_F11",\r
        "KC_NO",\r
        "KC_F1",\r
        "KC_F21",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_F17",\r
        "KC_F16",\r
        "KC_F7",\r
        "KC_NO",\r
        "KC_F6",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_F18",\r
        "KC_NO",\r
        "KC_F8",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_F19",\r
        "KC_NO",\r
        "KC_F9",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_F20",\r
        "KC_NO",\r
        "KC_F10",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ]\r
    ],\r
    [\r
      [\r
        "KC_TRNS",\r
        "KC_BTN2",\r
        "KC_TRNS",\r
        "KC_BTN1",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_BTN1",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_BTN3",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_BTN2",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "SV_SNIPER_3",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ],\r
      [\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_TRNS",\r
        "KC_NO"\r
      ]\r
    ]\r
  ],\r
  "encoder_layout": [],\r
  "layout_options": -1,\r
  "macro": [\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [],\r
    [\r
      [\r
        "text",\r
        ","\r
      ]\r
    ],\r
    []\r
  ],\r
  "svil_protocol": 1,\r
  "via_protocol": 12,\r
  "tap_dance": [\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    },\r
    {\r
      "on": true,\r
      "on_tap": "KC_NO",\r
      "on_hold": "KC_NO",\r
      "on_double_tap": "KC_NO",\r
      "on_tap_hold": "KC_NO",\r
      "tapping_term": 200\r
    }\r
  ],\r
  "combo": [\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    },\r
    {\r
      "on": true,\r
      "keys": [\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO",\r
        "KC_NO"\r
      ],\r
      "output": "KC_NO",\r
      "combo_term": 0\r
    }\r
  ],\r
  "key_override": [\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "trigger": "KC_NO",\r
      "replacement": "KC_NO",\r
      "layers": 65535,\r
      "trigger_mods": 0,\r
      "negative_mod_mask": 0,\r
      "suppressed_mods": 0,\r
      "options": 0\r
    }\r
  ],\r
  "alt_repeat_key": [\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "keycode": "KC_NO",\r
      "alt_keycode": "KC_NO",\r
      "allowed_mods": 0,\r
      "options": 0\r
    }\r
  ],\r
  "leader": [\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    },\r
    {\r
      "on": true,\r
      "sequence": [],\r
      "output": "KC_NO",\r
      "options": 0\r
    }\r
  ],\r
  "settings": {\r
    "1": 0,\r
    "2": 50,\r
    "3": 0,\r
    "4": 175,\r
    "5": 5,\r
    "6": 5000,\r
    "7": 200,\r
    "9": 30,\r
    "10": 20,\r
    "11": 1,\r
    "12": 15,\r
    "13": 40,\r
    "14": 10,\r
    "15": 80,\r
    "16": 8,\r
    "17": 40,\r
    "18": 0,\r
    "19": 80,\r
    "20": 5,\r
    "21": 128,\r
    "22": 1,\r
    "23": 0,\r
    "24": 0,\r
    "25": 200,\r
    "26": 1,\r
    "27": 0,\r
    "28": 300,\r
    "29": 1\r
  },\r
  "fragment_selections": {\r
  "left_pinky": "finger_5",\r
  "left_ring": "finger_5",\r
  "left_middle": "finger_5",\r
  "left_index": "finger_5",\r
  "right_index": "finger_5",\r
  "right_middle": "finger_5",\r
  "right_ring": "finger_5",\r
  "right_pinky": "finger_5",\r
    "left_thumb": "thumb_left",\r
    "right_thumb": "thumb_right"\r
  },\r
  "fragments": {\r
    "finger_5": {\r
      "id": 0,\r
      "description": "5-key finger cluster (no 2S)",\r
      "kle": [\r
        [\r
          {\r
            "x": 1\r
          },\r
          "N"\r
        ],\r
        [\r
          "W",\r
          "C",\r
          "E"\r
        ],\r
        [\r
          {\r
            "x": 1\r
          },\r
          "S"\r
        ]\r
      ]\r
    },\r
    "finger_6": {\r
      "id": 1,\r
      "description": "6-key finger cluster (with 2S)",\r
      "kle": [\r
        [\r
          {\r
            "x": 1\r
          },\r
          "N"\r
        ],\r
        [\r
          "W",\r
          "C",\r
          "E"\r
        ],\r
        [\r
          {\r
            "x": 1\r
          },\r
          "S"\r
        ],\r
        [\r
          {\r
            "x": 1\r
          },\r
          "2S"\r
        ]\r
      ]\r
    },\r
    "thumb_left": {\r
      "id": 2,\r
      "description": "Left thumb cluster (6 keys)",\r
      "kle": [\r
        [\r
          {\r
            "w": 1.5\r
          },\r
          "T1",\r
          "T2",\r
          {\r
            "w": 1.5\r
          },\r
          "T3"\r
        ],\r
        [\r
          {\r
            "x": -0.5,\r
            "w": 2\r
          },\r
          "T4",\r
          "T5",\r
          {\r
            "w": 1.5\r
          },\r
          "T6"\r
        ]\r
      ]\r
    },\r
    "thumb_right": {\r
      "id": 3,\r
      "description": "Right thumb cluster (6 keys)",\r
      "kle": [\r
        [\r
          {\r
            "w": 1.5\r
          },\r
          "T1",\r
          "T2",\r
          {\r
            "w": 1.5\r
          },\r
          "T3"\r
        ],\r
        [\r
          {\r
            "w": 1.5\r
          },\r
          "T4",\r
          "T5",\r
          {\r
            "w": 2\r
          },\r
          "T6"\r
        ]\r
      ]\r
    }\r
  },\r
  "composition": {\r
    "instances": [\r
      {\r
        "id": "left_pinky",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 0,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                4,\r
                3\r
              ],\r
              [\r
                4,\r
                4\r
              ],\r
              [\r
                4,\r
                2\r
              ],\r
              [\r
                4,\r
                1\r
              ],\r
              [\r
                4,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 0,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                4,\r
                3\r
              ],\r
              [\r
                4,\r
                4\r
              ],\r
              [\r
                4,\r
                2\r
              ],\r
              [\r
                4,\r
                1\r
              ],\r
              [\r
                4,\r
                0\r
              ],\r
              [\r
                4,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "left_ring",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 2.5,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                3,\r
                3\r
              ],\r
              [\r
                3,\r
                4\r
              ],\r
              [\r
                3,\r
                2\r
              ],\r
              [\r
                3,\r
                1\r
              ],\r
              [\r
                3,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 2.5,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                3,\r
                3\r
              ],\r
              [\r
                3,\r
                4\r
              ],\r
              [\r
                3,\r
                2\r
              ],\r
              [\r
                3,\r
                1\r
              ],\r
              [\r
                3,\r
                0\r
              ],\r
              [\r
                3,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "left_middle",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 6,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                2,\r
                3\r
              ],\r
              [\r
                2,\r
                4\r
              ],\r
              [\r
                2,\r
                2\r
              ],\r
              [\r
                2,\r
                1\r
              ],\r
              [\r
                2,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 6,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                2,\r
                3\r
              ],\r
              [\r
                2,\r
                4\r
              ],\r
              [\r
                2,\r
                2\r
              ],\r
              [\r
                2,\r
                1\r
              ],\r
              [\r
                2,\r
                0\r
              ],\r
              [\r
                2,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "left_index",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 8.5,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                1,\r
                3\r
              ],\r
              [\r
                1,\r
                4\r
              ],\r
              [\r
                1,\r
                2\r
              ],\r
              [\r
                1,\r
                1\r
              ],\r
              [\r
                1,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 8.5,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                1,\r
                3\r
              ],\r
              [\r
                1,\r
                4\r
              ],\r
              [\r
                1,\r
                2\r
              ],\r
              [\r
                1,\r
                1\r
              ],\r
              [\r
                1,\r
                0\r
              ],\r
              [\r
                1,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "right_index",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 13.5,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                6,\r
                3\r
              ],\r
              [\r
                6,\r
                4\r
              ],\r
              [\r
                6,\r
                2\r
              ],\r
              [\r
                6,\r
                1\r
              ],\r
              [\r
                6,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 13.5,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                6,\r
                3\r
              ],\r
              [\r
                6,\r
                4\r
              ],\r
              [\r
                6,\r
                2\r
              ],\r
              [\r
                6,\r
                1\r
              ],\r
              [\r
                6,\r
                0\r
              ],\r
              [\r
                6,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "right_middle",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 16,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                7,\r
                3\r
              ],\r
              [\r
                7,\r
                4\r
              ],\r
              [\r
                7,\r
                2\r
              ],\r
              [\r
                7,\r
                1\r
              ],\r
              [\r
                7,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 16,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                7,\r
                3\r
              ],\r
              [\r
                7,\r
                4\r
              ],\r
              [\r
                7,\r
                2\r
              ],\r
              [\r
                7,\r
                1\r
              ],\r
              [\r
                7,\r
                0\r
              ],\r
              [\r
                7,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "right_ring",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 19.5,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                8,\r
                3\r
              ],\r
              [\r
                8,\r
                4\r
              ],\r
              [\r
                8,\r
                2\r
              ],\r
              [\r
                8,\r
                1\r
              ],\r
              [\r
                8,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 19.5,\r
              "y": 0\r
            },\r
            "matrix_map": [\r
              [\r
                8,\r
                3\r
              ],\r
              [\r
                8,\r
                4\r
              ],\r
              [\r
                8,\r
                2\r
              ],\r
              [\r
                8,\r
                1\r
              ],\r
              [\r
                8,\r
                0\r
              ],\r
              [\r
                8,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "right_pinky",\r
        "fragment_options": [\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 22,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                9,\r
                3\r
              ],\r
              [\r
                9,\r
                4\r
              ],\r
              [\r
                9,\r
                2\r
              ],\r
              [\r
                9,\r
                1\r
              ],\r
              [\r
                9,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 22,\r
              "y": 1.5\r
            },\r
            "matrix_map": [\r
              [\r
                9,\r
                3\r
              ],\r
              [\r
                9,\r
                4\r
              ],\r
              [\r
                9,\r
                2\r
              ],\r
              [\r
                9,\r
                1\r
              ],\r
              [\r
                9,\r
                0\r
              ],\r
              [\r
                9,\r
                5\r
              ]\r
            ],\r
            "default": true\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "left_thumb",\r
        "fragment_options": [\r
          {\r
            "fragment": "thumb_left",\r
            "placement": {\r
              "x": 8,\r
              "y": 7\r
            },\r
            "matrix_map": [\r
              [\r
                0,\r
                3\r
              ],\r
              [\r
                0,\r
                5\r
              ],\r
              [\r
                0,\r
                1\r
              ],\r
              [\r
                0,\r
                4\r
              ],\r
              [\r
                0,\r
                2\r
              ],\r
              [\r
                0,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 8.5,\r
              "y": 7\r
            },\r
            "matrix_map": [\r
              [\r
                0,\r
                3\r
              ],\r
              [\r
                0,\r
                4\r
              ],\r
              [\r
                0,\r
                2\r
              ],\r
              [\r
                0,\r
                1\r
              ],\r
              [\r
                0,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 8.5,\r
              "y": 7\r
            },\r
            "matrix_map": [\r
              [\r
                0,\r
                3\r
              ],\r
              [\r
                0,\r
                4\r
              ],\r
              [\r
                0,\r
                2\r
              ],\r
              [\r
                0,\r
                1\r
              ],\r
              [\r
                0,\r
                0\r
              ],\r
              [\r
                0,\r
                5\r
              ]\r
            ]\r
          }\r
        ],\r
        "hardware_detect": false\r
      },\r
      {\r
        "id": "right_thumb",\r
        "fragment_options": [\r
          {\r
            "fragment": "thumb_right",\r
            "placement": {\r
              "x": 13,\r
              "y": 7\r
            },\r
            "matrix_map": [\r
              [\r
                5,\r
                1\r
              ],\r
              [\r
                5,\r
                5\r
              ],\r
              [\r
                5,\r
                3\r
              ],\r
              [\r
                5,\r
                0\r
              ],\r
              [\r
                5,\r
                2\r
              ],\r
              [\r
                5,\r
                4\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_5",\r
            "placement": {\r
              "x": 13.5,\r
              "y": 7\r
            },\r
            "matrix_map": [\r
              [\r
                5,\r
                3\r
              ],\r
              [\r
                5,\r
                4\r
              ],\r
              [\r
                5,\r
                2\r
              ],\r
              [\r
                5,\r
                1\r
              ],\r
              [\r
                5,\r
                0\r
              ]\r
            ]\r
          },\r
          {\r
            "fragment": "finger_6",\r
            "placement": {\r
              "x": 13.5,\r
              "y": 7\r
            },\r
            "matrix_map": [\r
              [\r
                5,\r
                3\r
              ],\r
              [\r
                5,\r
                4\r
              ],\r
              [\r
                5,\r
                2\r
              ],\r
              [\r
                5,\r
                1\r
              ],\r
              [\r
                5,\r
                0\r
              ],\r
              [\r
                5,\r
                5\r
              ]\r
            ]\r
          }\r
        ],\r
        "hardware_detect": false\r
      }\r
    ]\r
  },\r
  "keylayout": {\r
    "0": {\r
      "x": 10.8,\r
      "y": 6.5,\r
      "w": 1.5,\r
      "h": 1,\r
      "row": 0,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T6"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "1": {\r
      "x": 10.8,\r
      "y": 5.5,\r
      "w": 1.5,\r
      "h": 1,\r
      "row": 0,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T3"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "2": {\r
      "x": 9.8,\r
      "y": 6.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 0,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T5"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "3": {\r
      "x": 8.3,\r
      "y": 5.5,\r
      "w": 1.5,\r
      "h": 1,\r
      "row": 0,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T1"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "4": {\r
      "x": 7.800000000000001,\r
      "y": 6.5,\r
      "w": 2,\r
      "h": 1,\r
      "row": 0,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T4"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "5": {\r
      "x": 9.8,\r
      "y": 5.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 0,\r
      "col": 5,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T2"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "6": {\r
      "x": 9.5,\r
      "y": 3.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 1,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "7": {\r
      "x": 10.5,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 1,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "8": {\r
      "x": 9.5,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 1,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "9": {\r
      "x": 9.5,\r
      "y": 1.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 1,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "10": {\r
      "x": 8.5,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 1,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "12": {\r
      "x": 7,\r
      "y": 2,\r
      "w": 1,\r
      "h": 1,\r
      "row": 2,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "13": {\r
      "x": 8,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 2,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "14": {\r
      "x": 7,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 2,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "15": {\r
      "x": 7,\r
      "y": 0,\r
      "w": 1,\r
      "h": 1,\r
      "row": 2,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "16": {\r
      "x": 6,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 2,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "18": {\r
      "x": 3.5,\r
      "y": 2,\r
      "w": 1,\r
      "h": 1,\r
      "row": 3,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "19": {\r
      "x": 4.5,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 3,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "20": {\r
      "x": 3.5,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 3,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "21": {\r
      "x": 3.5,\r
      "y": 0,\r
      "w": 1,\r
      "h": 1,\r
      "row": 3,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "22": {\r
      "x": 2.5,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 3,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "24": {\r
      "x": 1,\r
      "y": 3.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 4,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "25": {\r
      "x": 2,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 4,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "26": {\r
      "x": 1,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 4,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "27": {\r
      "x": 1,\r
      "y": 1.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 4,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "28": {\r
      "x": 0,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 4,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "30": {\r
      "x": 12.7,\r
      "y": 6.5,\r
      "w": 1.5,\r
      "h": 1,\r
      "row": 5,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T4"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "31": {\r
      "x": 12.7,\r
      "y": 5.5,\r
      "w": 1.5,\r
      "h": 1,\r
      "row": 5,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T1"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "32": {\r
      "x": 14.2,\r
      "y": 6.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 5,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T5"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "33": {\r
      "x": 15.2,\r
      "y": 5.5,\r
      "w": 1.5,\r
      "h": 1,\r
      "row": 5,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T3"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "34": {\r
      "x": 15.2,\r
      "y": 6.5,\r
      "w": 2,\r
      "h": 1,\r
      "row": 5,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T6"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "35": {\r
      "x": 14.2,\r
      "y": 5.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 5,\r
      "col": 5,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "T2"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "36": {\r
      "x": 14.5,\r
      "y": 3.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 6,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "37": {\r
      "x": 15.5,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 6,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "38": {\r
      "x": 14.5,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 6,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "39": {\r
      "x": 14.5,\r
      "y": 1.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 6,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "40": {\r
      "x": 13.5,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 6,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "42": {\r
      "x": 17,\r
      "y": 2,\r
      "w": 1,\r
      "h": 1,\r
      "row": 7,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "43": {\r
      "x": 18,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 7,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "44": {\r
      "x": 17,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 7,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "45": {\r
      "x": 17,\r
      "y": 0,\r
      "w": 1,\r
      "h": 1,\r
      "row": 7,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "46": {\r
      "x": 16,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 7,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "48": {\r
      "x": 20.5,\r
      "y": 2,\r
      "w": 1,\r
      "h": 1,\r
      "row": 8,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "49": {\r
      "x": 21.5,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 8,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "50": {\r
      "x": 20.5,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 8,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "51": {\r
      "x": 20.5,\r
      "y": 0,\r
      "w": 1,\r
      "h": 1,\r
      "row": 8,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "52": {\r
      "x": 19.5,\r
      "y": 1,\r
      "w": 1,\r
      "h": 1,\r
      "row": 8,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "54": {\r
      "x": 23,\r
      "y": 3.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 9,\r
      "col": 0,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "S"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "55": {\r
      "x": 24,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 9,\r
      "col": 1,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "E"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "56": {\r
      "x": 23,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 9,\r
      "col": 2,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "C"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "57": {\r
      "x": 23,\r
      "y": 1.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 9,\r
      "col": 3,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "N"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    },\r
    "58": {\r
      "x": 22,\r
      "y": 2.5,\r
      "w": 1,\r
      "h": 1,\r
      "row": 9,\r
      "col": 4,\r
      "color": "#cccccc",\r
      "textColor": [],\r
      "labels": [\r
        "W"\r
      ],\r
      "rotation_angle": 0,\r
      "rotation_x": 0,\r
      "rotation_y": 0\r
    }\r
  },\r
  "cosmetic": {\r
    "layer": {},\r
    "layer_colors": {\r
      "0": "green",\r
      "1": "orange",\r
      "2": "blue",\r
      "3": "orange",\r
      "4": "yellow",\r
      "5": "blue",\r
      "6": "red",\r
      "7": "red",\r
      "8": "magenta",\r
      "9": "purple",\r
      "10": "orange",\r
      "11": "green",\r
      "12": "blue",\r
      "13": "blue",\r
      "14": "yellow",\r
      "15": "magenta"\r
    }\r
  },\r
  "custom_values": [\r
    {\r
      "key": "id_layer0_color",\r
      "channel": 0,\r
      "valueId": 0,\r
      "data": [\r
        85,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer1_color",\r
      "channel": 0,\r
      "valueId": 1,\r
      "data": [\r
        21,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer2_color",\r
      "channel": 0,\r
      "valueId": 2,\r
      "data": [\r
        149,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer3_color",\r
      "channel": 0,\r
      "valueId": 3,\r
      "data": [\r
        11,\r
        176\r
      ]\r
    },\r
    {\r
      "key": "id_layer4_color",\r
      "channel": 0,\r
      "valueId": 4,\r
      "data": [\r
        43,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer5_color",\r
      "channel": 0,\r
      "valueId": 5,\r
      "data": [\r
        128,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer6_color",\r
      "channel": 0,\r
      "valueId": 6,\r
      "data": [\r
        0,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer7_color",\r
      "channel": 0,\r
      "valueId": 7,\r
      "data": [\r
        0,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer8_color",\r
      "channel": 0,\r
      "valueId": 8,\r
      "data": [\r
        234,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer9_color",\r
      "channel": 0,\r
      "valueId": 9,\r
      "data": [\r
        191,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer10_color",\r
      "channel": 0,\r
      "valueId": 10,\r
      "data": [\r
        11,\r
        176\r
      ]\r
    },\r
    {\r
      "key": "id_layer11_color",\r
      "channel": 0,\r
      "valueId": 11,\r
      "data": [\r
        106,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer12_color",\r
      "channel": 0,\r
      "valueId": 12,\r
      "data": [\r
        128,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer13_color",\r
      "channel": 0,\r
      "valueId": 13,\r
      "data": [\r
        128,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer14_color",\r
      "channel": 0,\r
      "valueId": 14,\r
      "data": [\r
        43,\r
        255\r
      ]\r
    },\r
    {\r
      "key": "id_layer15_color",\r
      "channel": 0,\r
      "valueId": 15,\r
      "data": [\r
        213,\r
        255\r
      ]\r
    }\r
  ]\r
}\r
`,Xn={[$r]:{0:"Base",1:"Numbers"},[rn]:{0:"A or Ctrl"},[nn]:{1:"Greeting"},[Mr]:Hr},jn=32768,Qn=32768,Jn=128;function E(_,r,n){_[r]=n&255,_[r+1]=n>>8&255}function $n(_,r,n){const t=new TextEncoder().encode(n).subarray(0,c);_.set(t,r*c)}function Fr(){const _=U.join(".");return Yr()!==_&&Xr(_),Sr.registerKnownCustomKeycodes(Y.customKeycodes??[]),r=>{const n=Sr.parse(r);return Number.isFinite(n)&&n>=0&&n<=65535?n:0}}function Pr(_=Fr()){const r=JSON.parse(Yn).layout??[],n=new Uint8Array(y*S*g*2);for(let t=0;t<y;t++)for(let e=0;e<S;e++)for(let s=0;s<g;s++){const o=r[t]?.[e]?.[s],i=o?_(o):0,a=((t*S+e)*g+s)*2;n[a]=i>>8,n[a+1]=i&255}return n}function xr(_,r){const n=[];for(const[t,...e]of _)if(t==="text"&&n.push(...new TextEncoder().encode(String(e[0]))),t==="tap")for(const s of e){const o=r(String(s));o>0&&o<256?n.push(1,1,o):o>=256&&n.push(1,5,o&255,o>>8)}return n}function re(){const _=Fr(),r=q();r.keymap=Pr(_),ur.combo.forEach((e,s)=>{const o=s*ar;e.keys.forEach((i,a)=>E(r.combo,o+a*2,_(i))),E(r.combo,o+8,_(e.output)),E(r.combo,o+10,(e.on?jn:0)|e.combo_term&32767)}),ur.tap_dance.forEach((e,s)=>{const o=s*B;[e.on_tap,e.on_hold,e.on_double_tap,e.on_tap_hold].forEach((i,a)=>E(r.tapDance,o+a*2,_(i))),E(r.tapDance,o+8,(e.on?Qn:0)|e.tapping_term&32767)});const n=[xr([["tap","KC_A"]],_),xr([["text","hello world"]],_)];let t=0;for(const e of n)r.macros.set(e,t),t+=e.length+1;E(r.keyOverride,0,_("KC_BSPACE")),E(r.keyOverride,2,_("KC_DELETE")),r.keyOverride.set([255,255,0,0,34,0,34,Jn|7],4);for(const[e,s]of Object.entries(Xn))for(const[o,i]of Object.entries(s))$n(r.labels[Number(e)],Number(o),i);return r.fragments.fill(0,0,D),r}const R="Simulated Svalboard",ne=12346,ee=16452,te=32;function oe(_){const r={reportId:0,items:[{reportSize:8,reportCount:_,usagePage:65376}]};return{usagePage:65376,usage:97,type:1,children:[],inputReports:[r],outputReports:[r],featureReports:[]}}function _e(){if(typeof MessageChannel<"u"&&typeof window<"u"&&!/jsdom/i.test(navigator.userAgent)){const _=new MessageChannel,r=[];return _.port1.onmessage=()=>r.shift()?.(),n=>{r.push(n),_.port2.postMessage(0)}}return _=>setTimeout(_,0)}function se(){if(typeof Worker>"u"||typeof Blob>"u"||typeof URL?.createObjectURL!="function")return null;try{const _="onmessage = (e) => { const [id, due] = e.data; while (performance.timeOrigin + performance.now() < due) {} postMessage(id); };",r=new Worker(URL.createObjectURL(new Blob([_],{type:"text/javascript"}))),n=new Map;let t=0,e=!1;return r.onerror=()=>{e=!0;for(const s of n.values())setTimeout(s,0);n.clear()},r.onmessage=s=>{const o=n.get(s.data);n.delete(s.data),o?.()},(s,o)=>{if(e){setTimeout(s,o);return}const i=t++;n.set(i,s),r.postMessage([i,performance.timeOrigin+performance.now()+o])}}catch{return null}}class Er extends EventTarget{oninputreport=null;vendorId=ne;productId=ee;productName=R;reportLength;collections;firmware;sent=[];replyDelayMs=0;isOpen=!1;persisting;schedule;linkClock;constructor(r={}){super(),this.reportLength=r.reportLength??te,this.collections=[oe(this.reportLength)];const n=r.persist??(!r.state&&r.seedTurbo===void 0&&!r.seedLeaderZero&&!r.seedUnread);this.persisting=n;let t=r.state??(n?an():null);if(!t){if(t=re(),r.seedTurbo!==void 0){const e=t.custom;e[18]=r.seedTurbo,e[26]=e[27]=e[28]=e[29]=0}r.seedLeaderZero&&(t.qmkSettings[40]=t.qmkSettings[41]=0,t.qmkSettings[42]=0),r.seedUnread&&(t.tapDance[18]=0,t.tapDance[19]=0,t.tapDance[10]=5,t.tapDance[11]=0),n&&Rr(t)}this.firmware=new Zn(t,{comboLabels:r.comboLabels??!0,typingPause:r.typingPause??!0,flickerLatch:r.flickerLatch??!0,debugConsole:r.debugConsole??!0,debounceSwitch:r.debounceSwitch??!0,timingUsOnly:r.timingUsOnly??!0,padGestures:r.padGestures??!0,touchpad:r.touchpad??!1,hostTouchpad:r.hostTouchpad??!1,multiFinger:r.multiFinger??!0,onChange:e=>{this.persisting&&Rr(e)},factoryKeymap:Pr(),serial:r.serial,unread:r.seedUnread?{qmkSettings:!0,customIds:[0,7]}:void 0}),this.schedule=r.schedule??_e()}forgetSettings(){this.persisting=!1,Cn()}present=!0;async simulateFirmwareUpdate(r={}){const n=typeof navigator<"u"?navigator.hid:void 0,t=e=>{const s=new Event(e);Object.defineProperty(s,"device",{value:this}),n?.dispatchEvent(s)};this.present=!1,this.isOpen=!1,t("disconnect"),await new Promise(e=>setTimeout(e,r.goneMs??1500)),this.firmware.firstBootReset(r.flags??4),this.present=!0,t("connect")}asHIDDevice(){return this}get opened(){return this.isOpen}get state(){return this.firmware.state}async open(){this.isOpen=!0}async close(){this.isOpen=!1}async forget(){this.isOpen=!1}async sendReport(r,n){if(!this.isOpen)throw new DOMException("The device must be opened first.","InvalidStateError");const t=n instanceof ArrayBuffer?new Uint8Array(n):new Uint8Array(n.buffer,n.byteOffset,n.byteLength),e=new Uint8Array(this.reportLength);if(e.set(t.subarray(0,this.reportLength)),this.sent.push(e),this.sent.length>2e3&&this.sent.splice(0,this.sent.length-2e3),r!==0)return;let s;try{s=this.firmware.receive(e)}catch(o){console.error("[fake board] The simulated firmware failed on a report:",o),s=null}if(s)if(this.replyDelayMs>0){this.linkClock===void 0&&(this.linkClock=se());const o=this.linkClock;o?o(()=>this.deliver(s),this.replyDelayMs):setTimeout(()=>this.deliver(s),this.replyDelayMs)}else this.schedule(()=>this.deliver(s))}async sendFeatureReport(){throw new DOMException("The simulated board has no feature reports.","NotSupportedError")}async receiveFeatureReport(){throw new DOMException("The simulated board has no feature reports.","NotSupportedError")}deliver(r){if(!this.isOpen)return;const n=new ArrayBuffer(this.reportLength);new Uint8Array(n).set(r);const t=new Event("inputreport");Object.defineProperties(t,{device:{value:this},reportId:{value:0},data:{value:new DataView(n)}}),this.oninputreport?.(t),this.dispatchEvent(t)}}function ae(_,r){const n=document.createElement("div");n.setAttribute("role","status"),n.dataset.fakeBoardBadge=_,n.className="fixed bottom-2 right-2 z-[1000] flex items-center gap-2 rounded-full border border-kb-gray-border bg-kb-warn-bg px-3 py-1 text-xs font-medium text-kb-warn-ink shadow-sm";const t=document.createElement("span");t.textContent=_==="old"?`${R}, firmware without combo names`:_==="no-pause"?`${R}, firmware that can't pause typing`:_==="turbo6"?`${R}, updated from turbo 6`:_==="leader0"?`${R}, leader timeout stored as 0`:_==="touchpad"?`${R}, touchpads`:_==="touchpad-gestures"?`${R}, touchpads on built-in gestures`:_==="touchpad-434"?`${R}, touchpads, v4.3.4 firmware`:_==="unread"?`${R}, some reads unanswered`:R;const e=document.createElement("button");e.type="button",e.textContent="Reset",e.title="Put the simulated board back to its starting settings",e.className="cursor-pointer underline underline-offset-2 text-kb-warn-ink",e.addEventListener("click",()=>{window.confirm("Put the simulated board back to its starting settings? Its changes are lost.")&&r()}),n.append(t,e);const s=()=>document.body.appendChild(n);document.body?s():document.addEventListener("DOMContentLoaded",s,{once:!0})}function Ce(_){const r=_==="touchpad"||_==="touchpad-gestures"||_==="touchpad-434",n=_==="combo-names"||_==="turbo6"||_==="leader0"||_==="unread"||r,t=new Er({comboLabels:_!=="old",typingPause:n,flickerLatch:n,debugConsole:n&&_!=="touchpad-434",debounceSwitch:n,timingUsOnly:n,seedTurbo:_==="turbo6"?6:void 0,seedLeaderZero:_==="leader0",seedUnread:_==="unread",reportLength:n?64:32,padGestures:n,touchpad:r,hostTouchpad:_==="touchpad"||_==="touchpad-434",multiFinger:_!=="touchpad-434"}),e=()=>{t.forgetSettings(),window.location.reload()},s=()=>{const o=new Er({persist:!1,serial:[14,126,18,52,86,120,154,188],reportLength:n?64:32});return navigator.hid?.others?.unshift(o.asHIDDevice()),o};return window.keybardFakeBoard={device:t,wipe:e,addOtherBoard:s},ae(_,e),console.info(`[fake board] ${R} (${_==="old"?"firmware without combo names":_==="no-pause"?"firmware that can't pause typing":"combo names on the board"}) in place of WebHID.`),t.asHIDDevice()}export{Ce as installFakeBoard};
