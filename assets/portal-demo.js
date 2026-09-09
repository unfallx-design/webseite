/* Public, fictitious data only. This read-only demo never authenticates or calls an API. */
(() => {
  'use strict';
  const user={id:'demo-partner',name:'Alex Beispiel',role:'partner',email:'demo@example.com',preferences:{startPage:'start',theme:'light',compact:false,reducedMotion:false}};
  const company={id:'demo-company',name:'Beispielwerkstatt Leipzig GmbH',contact:'Alex Beispiel',email:'demo@example.com',type:'Werkstatt',street:'Beispielstraße 1',postcode:'04109',city:'Leipzig',phone:'Nicht erreichbar – Demo',status:'approved'};
  const cases=[
    {id:'11111111-1111-4111-8111-111111111111',number:'DEMO-001',vehicle:'BMW 3er',location:'Leipzig',status:'review',description:'Fiktives Beispiel: Seitlicher Anstoß mit Beschädigung der vorderen Tür. Fahrzeug und Auftrag wurden aufgenommen. UNFALLX prüft die eingereichten Unterlagen.'},
    {id:'22222222-2222-4222-8222-222222222222',number:'DEMO-002',vehicle:'VW Golf',location:'Potsdam',status:'needs_info',description:'Fiktives Beispiel: Beschädigter hinterer Stoßfänger nach einem Parkunfall. Für die weitere Beurteilung wird eine zusätzliche Übersicht aus größerem Abstand benötigt.'},
    {id:'33333333-3333-4333-8333-333333333333',number:'DEMO-003',vehicle:'Renault Talisman',location:'Berlin',status:'in_progress',description:'Fiktives Beispiel: Sichtbarer Frontschaden. Die Unterlagen wurden geprüft und der Fall angenommen. Das Gutachten wird durch UNFALLX bearbeitet.'}
  ].map((c,i)=>({id:c.id,number:c.number,companyId:company.id,ownerUserId:null,source:'partner',companyName:company.name,status:c.status,version:1,createdAt:'2026-09-08T09:00:00.000Z',updatedAt:`2026-09-09T0${9-i}:00:00.000Z`,finance:null,intake:{vehicle:c.vehicle,plate:'DEMO',vin:'',accidentDate:'2026-09-07',location:c.location,owner:'Fiktiver Auftraggeber',ownerContact:'kunde@example.com',description:c.description,insurer:'Beispielversicherung',claimNumber:'BEISPIEL-'+(i+1),lawyerEmail:'',authority:true,shareWithLawyer:false}}));
  function read(path){
    if(path==='/me')return structuredClone({user,company,csrf:'demo'});
    if(path==='/cases')return structuredClone({cases});
    if(path==='/statistics')return {total:cases.length,active:cases.length,needsInfo:1,reports:0,averageDays:null,durationSample:0,scope:'Fiktive Beispieldaten',groups:[{status:'review',label:'In Prüfung',count:1},{status:'needs_info',label:'Rückfrage',count:1},{status:'in_progress',label:'Gutachten in Arbeit',count:1}],months:[{month:'2026-09',created:3,reports:0}]};
    if(path==='/referrals')return {code:null,url:null,referredAccounts:0,rewards:[],totals:{offered:0,approved:0,paid:0}};
    if(path==='/settings')return structuredClone({profile:{...user,phone:'',jobTitle:'Partnerbetrieb'},preferences:user.preferences,activeSessions:0,storage:null});
    if(path==='/documents')return {documents:[],companies:[]};
    if(path==='/export')return structuredClone({notice:'Fiktive Beispieldaten',user,company,cases});
    if(path.startsWith('/cases/')){const c=cases.find(c=>path==='/cases/'+c.id);if(!c)throw new Error('Beispielfall nicht gefunden.');return structuredClone({case:c,files:c.number==='DEMO-001'?[{id:'demo-photo',name:'Beispiel-Seitenschaden.webp',type:'image/webp',kind:'photo',size:124000,at:c.updatedAt,preview:'/assets/ux-cinema-side-small.webp'}]:[],payments:[],events:[{id:'demo-event-1',at:'2026-09-08T09:00:00Z',actor:'Alex Beispiel',action:'Fall eingereicht',note:'Beispielfall mit fiktiven Angaben.'},{id:'demo-event-2',at:c.updatedAt,actor:'UNFALLX Beispielteam',action:c.status==='needs_info'?'Rückfrage zu den Unterlagen':'Bearbeitung aktualisiert',note:c.status==='needs_info'?'Bitte ergänze eine Übersichtsaufnahme des gesamten Fahrzeughecks.':'Die Unterlagen sind eingegangen und werden bearbeitet.'}]});}
    throw new Error('Diese Ansicht ist in der Demo nicht verfügbar.');
  }
  window.UNFALLX_DEMO_DATA={read};
})();
