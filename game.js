
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {franchises, players, sampleFixtures} from "./data.js";

const $ = id => document.getElementById(id);
const money = value => `₹${value.toFixed(1)} Cr`;

const state = {
  runs:0, wickets:0, balls:0, fours:0, sixes:0,
  started:false, finished:false, deliveryActive:false,
  deliveryStart:0, deliveryDuration:1550,
  lastBall:"—", history:[], purse:120, signed:[],
  ball:null, ballStart:new THREE.Vector3(),
  ballTarget:new THREE.Vector3(), ballProgress:0,
  shotPlayed:false
};

let scene, camera, renderer, clock;
let batter, bowler, ball, stadiumRoot;
let animationFrame=0;
let resizeObserver=null;

function toast(message){
  const element=$("toast");
  element.textContent=message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>element.classList.remove("show"),2600);
}

function goTo(page){
  document.querySelectorAll(".page").forEach(element=>element.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(element=>{
    element.classList.toggle("active",element.dataset.page===page);
  });
  const target=$(`page-${page}`);
  if(!target)return;
  target.classList.add("active");
  $("page-title").textContent={
    dashboard:"Command Center",
    match:"Live Match Centre",
    auction:"Auction Room",
    teams:"Franchise Universe",
    tournament:"Championship Centre",
    players:"Player Universe",
    records:"Hall of Records"
  }[page];
  $("section-name").textContent=page.toUpperCase();
  if(page==="match")setTimeout(resizeScene,100);
  window.scrollTo({top:0,behavior:"smooth"});
}

document.querySelectorAll("[data-page]").forEach(button=>{
  button.addEventListener("click",()=>goTo(button.dataset.page));
});
document.querySelectorAll("[data-go]").forEach(button=>{
  button.addEventListener("click",()=>goTo(button.dataset.go));
});

function renderTeams(){
  $("dashboard-teams").innerHTML=franchises.slice(0,5).map(team=>`
    <div class="mini-team">
      <div class="mini-crest" style="background:${team.color};color:#101827">${team.short}</div>
      <div><strong>${team.name}</strong><small>${team.city}</small></div>
    </div>
  `).join("");

  $("franchise-grid").innerHTML=franchises.map(team=>`
    <article class="franchise-card">
      <div class="franchise-top">
        <div class="franchise-crest" style="background:${team.color};color:#101827">${team.short}</div>
        <div><h3>${team.name}</h3><p>${team.city}, India</p></div>
      </div>
      <div class="franchise-meta">
        <span>HOME GROUND</span><span>${team.home}</span>
      </div>
    </article>
  `).join("");
}

function renderPlayers(){
  const query=$("player-search").value.toLowerCase().trim();
  const role=$("role-filter").value;
  const filtered=players.filter(player=>{
    const matchesText=player.name.toLowerCase().includes(query)||
      player.country.toLowerCase().includes(query);
    return matchesText&&(role==="All"||player.role===role);
  });

  $("player-grid").innerHTML=filtered.map(player=>`
    <article class="player-card">
      <div class="player-avatar">${player.name.split(" ").map(part=>part[0]).slice(0,2).join("")}</div>
      <div class="player-info">
        <h3>${player.name}</h3>
        <p>${player.role} • ${player.country} • ${player.team}</p>
      </div>
      <div class="player-rating">${player.rating}</div>
    </article>
  `).join("")||'<p class="muted">No players found.</p>';
}

function renderAuction(){
  $("auction-list").innerHTML=players.slice(0,18).map(player=>{
    const signed=state.signed.includes(player.id);
    const canBid=!signed&&player.price<=state.purse;
    return `<tr>
      <td><strong>${player.name}</strong></td>
      <td>${player.role}</td>
      <td>${player.country}</td>
      <td>${money(player.price)}</td>
      <td><button class="bid-button" data-bid="${player.id}" ${canBid?"":"disabled"}>
        ${signed?"SIGNED":canBid?"BID":"NO PURSE"}
      </button></td>
    </tr>`;
  }).join("");

  $("purse").textContent=money(state.purse);
  $("signed-count").textContent=state.signed.length;

  document.querySelectorAll("[data-bid]").forEach(button=>{
    button.addEventListener("click",()=>bidPlayer(Number(button.dataset.bid)));
  });
}

function bidPlayer(id){
  const player=players.find(item=>item.id===id);
  if(!player||state.signed.includes(id)||player.price>state.purse)return;
  state.purse-=player.price;
  state.signed.push(id);
  renderAuction();
  toast(`${player.name} signed for ${money(player.price)}.`);
}

function renderFixtures(){
  $("fixtures-list").innerHTML=sampleFixtures.map(fixture=>{
    const home=franchises.find(team=>team.id===fixture.home);
    const away=franchises.find(team=>team.id===fixture.away);
    return `<div class="fixture-row">
      <span class="fixture-date">${fixture.date}</span>
      <strong class="fixture-team">${home.short} · ${home.city}</strong>
      <span class="fixture-vs">VS</span>
      <strong class="fixture-team">${away.short} · ${away.city}</strong>
      <span class="fixture-date">${fixture.venue}</span>
    </div>`;
  }).join("");
}

function updateScore(){
  const completedOvers=Math.floor(state.balls/6);
  const remainingBalls=state.balls%6;
  $("score").textContent=`${state.runs}/${state.wickets}`;
  $("overs").textContent=`${completedOvers}.${remainingBalls}`;
  $("run-rate").textContent=state.balls
    ?(state.runs/(state.balls/6)).toFixed(2)
    :"0.00";
  $("last-ball").textContent=state.lastBall;
  $("career-runs").textContent=state.runs;
  $("record-runs").textContent=state.runs;
  $("record-boundaries").textContent=state.fours+state.sixes;
  $("record-wickets").textContent=state.wickets;
  $("record-balls").textContent=state.balls;

  $("delivery-history").innerHTML=state.history.length
    ?state.history.slice().reverse().map((item,index)=>`
      <div class="history-row">
        <span>Delivery ${state.history.length-index}</span><span>${item}</span>
      </div>
    `).join("")
    :'<p class="muted">Play a match to create your first match record.</p>';
}

function resetInnings(){
  state.runs=0;
  state.wickets=0;
  state.balls=0;
  state.fours=0;
  state.sixes=0;
  state.lastBall="—";
  state.history=[];
  state.started=false;
  state.finished=false;
  state.deliveryActive=false;
  state.shotPlayed=false;

  $("start-match").disabled=false;
  $("start-match").textContent="START MATCH";
  $("shot-button").disabled=true;
  $("match-status").textContent="MATCH READY";
  $("match-message").textContent="Ready for the first delivery?";

  if(ball)ball.visible=false;
  updateScore();
}

function startMatch(){
  if(state.finished)resetInnings();
  if(state.started)return;

  state.started=true;
  $("start-match").disabled=true;
  $("start-match").textContent="MATCH IN PROGRESS";
  $("match-status").textContent="LIVE MATCH";
  $("match-message").textContent="The bowler is preparing to deliver…";
  nextDelivery();
}

function nextDelivery(){
  if(!state.started||state.finished||state.deliveryActive)return;
  if(state.wickets>=10||state.balls>=120){
    finishMatch();
    return;
  }

  state.deliveryActive=true;
  state.shotPlayed=false;
  state.deliveryStart=performance.now();
  state.deliveryDuration=1350+Math.random()*400;

  if(ball){
    ball.position.set(0,1.25,8.3);
    ball.visible=true;
  }

  $("match-message").textContent="Watch the ball. Choose your timing!";
  $("shot-button").disabled=false;
}

function playShot(){
  if(!state.started||!state.deliveryActive||state.shotPlayed)return;

  state.shotPlayed=true;
  const elapsed=performance.now()-state.deliveryStart;
  const progress=Math.max(0,Math.min(1,elapsed/state.deliveryDuration));
  const quality=1-Math.min(1,Math.abs(progress-.78)/.42);
  const random=Math.random();

  let runs=0;
  let wicket=false;
  let label="DOT";

  if(quality>.88){
    if(random<.34){runs=6;label="SIX";state.sixes++;}
    else if(random<.70){runs=4;label="FOUR";state.fours++;}
    else if(random<.90){runs=2;label="2 RUNS";}
    else{runs=1;label="1 RUN";}
  }else if(quality>.62){
    if(random<.12){wicket=true;label="WICKET";}
    else if(random<.35){runs=4;label="FOUR";state.fours++;}
    else if(random<.60){runs=2;label="2 RUNS";}
    else if(random<.84){runs=1;label="1 RUN";}
  }else{
    if(random<.18){wicket=true;label="WICKET";}
    else if(random<.55){runs=1;label="1 RUN";}
  }

  if(wicket)state.wickets++;
  state.runs+=runs;
  state.balls++;
  state.lastBall=label;
  state.history.push(label);
  if(state.history.length>30)state.history.shift();

  $("match-message").textContent=wicket
    ?"WICKET! The batter is out."
    :runs===6?"SIX! A huge hit into the stands!"
    :runs===4?"FOUR! The ball reaches the boundary!"
    :runs>0?"Good running between the wickets."
    :"Dot ball. Get ready for the next delivery.";

  $("shot-button").disabled=true;
  updateScore();
  animateShot(runs);

  setTimeout(()=>{
    state.deliveryActive=false;
    if(state.wickets>=10||state.balls>=120){
      finishMatch();
    }else if(state.started){
      nextDelivery();
    }
  },1100);
}

function animateShot(runs){
  if(!ball)return;

  const start=ball.position.clone();
  const target=start.clone().add(new THREE.Vector3(
    (Math.random()-.5)*9,
    runs>=4?5:1.5,
    runs===6?-13:runs===4?-9:-4
  ));

  const began=performance.now();

  function animate(now){
    const progress=Math.min(1,(now-began)/750);
    ball.position.lerpVectors(start,target,progress);
    ball.position.y+=Math.sin(progress*Math.PI)*(runs>=4?3:1);
    if(progress<1)requestAnimationFrame(animate);
    else ball.visible=false;
  }

  requestAnimationFrame(animate);
}

function finishMatch(){
  state.finished=true;
  state.started=false;
  state.deliveryActive=false;
  $("shot-button").disabled=true;
  $("start-match").disabled=false;
  $("start-match").textContent="PLAY AGAIN";
  $("match-status").textContent="INNINGS COMPLETE";
  $("match-message").textContent=
    `Innings complete: ${state.runs}/${state.wickets} in ${Math.floor(state.balls/6)}.${state.balls%6} overs.`;
  toast("Innings complete. Check your scorecard!");
}

function addBox(parent,width,height,depth,material,x,y,z){
  const mesh=new THREE.Mesh(
    new THREE.BoxGeometry(width,height,depth),
    material
  );
  mesh.position.set(x,y,z);
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
}

function makePlayer(parent,x,z,shirtColor){
  const group=new THREE.Group();
  group.position.set(x,0,z);
  parent.add(group);

  const shirt=new THREE.MeshStandardMaterial({color:shirtColor,roughness:.8});
  const skin=new THREE.MeshStandardMaterial({color:0xc18a62,roughness:.9});
  const trousers=new THREE.MeshStandardMaterial({color:0xe2e7ed,roughness:1});

  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.23,.55,4,8),shirt);
  body.position.y=1.05;
  body.castShadow=true;
  group.add(body);

  const head=new THREE.Mesh(new THREE.SphereGeometry(.17,14,12),skin);
  head.position.y=1.65;
  head.castShadow=true;
  group.add(head);

  const legs=new THREE.Mesh(new THREE.BoxGeometry(.32,.55,.28),trousers);
  legs.position.y=.35;
  group.add(legs);

  return group;
}

function buildStadium(){
  const root=new THREE.Group();
  scene.add(root);
  stadiumRoot=root;

  const grass=new THREE.MeshStandardMaterial({color:0x276a46,roughness:1});
  const darkGrass=new THREE.MeshStandardMaterial({color:0x1c593b,roughness:1});
  const sand=new THREE.MeshStandardMaterial({color:0xc6a477,roughness:1});
  const white=new THREE.MeshStandardMaterial({color:0xf1f2e9});
  const concrete=new THREE.MeshStandardMaterial({color:0x263449,roughness:.9});
  const seatColors=[0x354d69,0x405c76,0x293d56,0x66748a];

  const field=new THREE.Mesh(new THREE.CircleGeometry(15,80),grass);
  field.rotation.x=-Math.PI/2;
  field.position.y=-.08;
  field.scale.set(1.22,.85,1);
  field.receiveShadow=true;
  root.add(field);

  for(let i=0;i<5;i++){
    const ring=new THREE.Mesh(
      new THREE.TorusGeometry(17+i*.55,.25,6,100),
      new THREE.MeshStandardMaterial({color:seatColors[i%seatColors.length]})
    );
    ring.rotation.x=Math.PI/2;
    ring.scale.set(1.2,.85,1);
    ring.position.y=1.2+i*.45;
    root.add(ring);
  }

  const boundary=new THREE.Mesh(
    new THREE.TorusGeometry(15,.10,6,100),
    white
  );
  boundary.rotation.x=Math.PI/2;
  boundary.scale.set(1.22,.85,1);
  boundary.position.y=.04;
  root.add(boundary);

  const pitch=addBox(root,2.2,.12,13,sand,new THREE.MeshStandardMaterial({color:0xb99770}),0,.02,0);
  pitch.receiveShadow=true;

  for(const z of [-5.6,5.6]){
    for(const x of [-.32,0,.32]){
      addBox(root,.07,.9,.07,white,x,.5,z);
    }
    addBox(root,1.1,.045,.08,white,0,.95,z);
    for(const x of [-.45,.45]){
      addBox(root,.08,.055,.08,white,x,.92,z);
    }
  }

  const lightMaterial=new THREE.MeshStandardMaterial({
    color:0xeaf4ff,emissive:0x9dbbff,emissiveIntensity:1.2
  });

  for(const x of [-20,20]){
    for(const z of [-12,12]){
      addBox(root,.25,9,.25,concrete,x,4.5,z);
      const lamp=addBox(root,2,.18,.7,lightMaterial,x,9,z);
      lamp.castShadow=false;
    }
  }

  for(let i=0;i<28;i++){
    const angle=(i/28)*Math.PI*2;
    const x=Math.cos(angle)*19;
    const z=Math.sin(angle)*14;
    const stand=addBox(root,1.15,3,1.15,concrete,x,1.7,z);
    stand.rotation.y=-angle;
  }

  const batterGroup=new THREE.Group();
  root.add(batterGroup);
  batter=makePlayer(batterGroup,0,4.2,0xf0c64e);

  const bat=new THREE.Mesh(
    new THREE.BoxGeometry(.13,1.25,.13),
    new THREE.MeshStandardMaterial({color:0xd7b27b,roughness:.7})
  );
  bat.position.set(.35,1.1,-.05);
  bat.rotation.z=-.3;
  batter.add(bat);

  bowler=makePlayer(root,0,-7,0x397bd0);

  const fielderPositions=[
    [-5,-4],[5,-4],[-8,1],[8,1],[-6,8],[6,8],
    [-10,-6],[10,-6],[-11,5],[11,5]
  ];
  fielders=fielderPositions.map((position,index)=>
    makePlayer(root,position[0],position[1],
      index%2?0xe8edf4:0x397bd0)
  );

  const ballMaterial=new THREE.MeshStandardMaterial({
    color:0xd94343,roughness:.35,metalness:.05
  });
  ball=new THREE.Mesh(new THREE.SphereGeometry(.16,20,16),ballMaterial);
  ball.castShadow=true;
  ball.position.set(0,1.25,8.3);
  ball.visible=false;
  root.add(ball);

  const sky=new THREE.Mesh(
    new THREE.SphereGeometry(80,32,20),
    new THREE.MeshBasicMaterial({color:0x101f35,side:THREE.BackSide})
  );
  root.add(sky);
}

function initScene(){
  const container=$("stadium-canvas");
  if(!container||scene)return;

  try{
    scene=new THREE.Scene();
    scene.background=new THREE.Color(0x101c2d);
    scene.fog=new THREE.Fog(0x101c2d,35,75);

    camera=new THREE.PerspectiveCamera(43,1,.1,150);
    camera.position.set(17,16,22);
    camera.lookAt(0,1,0);

    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;

    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8ddff,0x243b2e,2));

    const sun=new THREE.DirectionalLight(0xffe4b2,3);
    sun.position.set(-10,20,12);
    sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);
    scene.add(sun);

    buildStadium();
    clock=new THREE.Clock();
    resizeScene();

    $("stadium-loading").style.display="none";
    state.sceneReady=true;
    animateScene();
  }catch(error){
    console.error("3D stadium could not start:",error);
    $("stadium-loading").textContent="3D VIEW UNAVAILABLE — CHECK YOUR INTERNET CONNECTION";
  }
}

function resizeScene(){
  if(!renderer||!camera)return;
  const container=$("stadium-canvas");
  const width=container.clientWidth;
  const height=container.clientHeight;
  if(!width||!height)return;

  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
}

function animateScene(){
  animationFrame=requestAnimationFrame(animateScene);
  if(!renderer||!scene||!camera)return;

  const delta=Math.min(clock.getDelta(),.04);
  const elapsed=clock.elapsedTime;

  if(stadiumRoot){
    stadiumRoot.rotation.y=Math.sin(elapsed*.08)*.018;
  }

  if(ball&&state.deliveryActive&&!state.shotPlayed){
    const progress=Math.min(
      1,(performance.now()-state.deliveryStart)/state.deliveryDuration
    );
    ball.position.z=8.3-(progress*13.3);
    ball.position.y=1.25+Math.sin(progress*Math.PI)*.25;
  }

  if(bowler&&state.deliveryActive){
    bowler.rotation.x=Math.sin(elapsed*8)*.05;
  }

  renderer.render(scene,camera);
}

function setupControls(){
  $("start-match").addEventListener("click",startMatch);
  $("shot-button").addEventListener("click",playShot);
  $("player-search").addEventListener("input",renderPlayers);
  $("role-filter").addEventListener("change",renderPlayers);

  document.addEventListener("keydown",event=>{
    if(event.code==="Space"){
      const activePage=$("page-match").classList.contains("active");
      if(activePage){
        event.preventDefault();
        playShot();
      }
    }
    if(event.key.toLowerCase()==="r"&&
      $("page-match").classList.contains("active")){
      resetInnings();
    }
  });

  $("sound-toggle").addEventListener("click",()=>{
    state.sound=!state.sound;
    $("sound-toggle").textContent=state.sound?"♫":"♪";
    toast("Sound setting saved for this session. Match audio is not enabled yet.");
  });

  if("ResizeObserver"in window){
    resizeObserver=new ResizeObserver(resizeScene);
    resizeObserver.observe($("stadium-canvas"));
  }else{
    window.addEventListener("resize",resizeScene);
  }
}

function boot(){
  renderTeams();
  renderPlayers();
  renderAuction();
  renderFixtures();
  updateScore();
  setupControls();
  initScene();
}

boot();
