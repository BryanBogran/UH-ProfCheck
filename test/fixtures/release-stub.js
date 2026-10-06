// Deterministic test double. It never sends network requests or touches user preferences.
(() => {
  const settings = {}, listeners = [], calls = [], errors = [];
  const data = {
    'Instructor Alpha':{rmp:{avgRating:4.9,numRatings:120,link:'#rating'},cougarGrades:{gpa:2.9,dropRate:2,link:'#grade'}},
    'Instructor Beta':{rmp:{avgRating:3.4,numRatings:110,link:'#rating'},cougarGrades:{gpa:3.85,dropRate:14,link:'#grade'}},
    'Instructor Gamma':{rmp:{avgRating:4.1,numRatings:29,link:'#rating'},cougarGrades:{gpa:3.2,dropRate:7,link:'#grade'}}
  };
  const set = async (values) => {
    const changes = {};
    for (const [key,value] of Object.entries(values)) {
      changes[key] = { oldValue:settings[key],newValue:value };
      settings[key] = value;
    }
    listeners.forEach(fn => fn(changes,'sync'));
  };
  const root = new URL('../../',document.currentScript.src);
  window.RELEASE_TEST = { settings,set,calls,errors,fail:false };
  window.addEventListener('error',e=>errors.push(String(e.error?.stack || e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason?.stack || e.reason)));
  const original = console.error.bind(console);
  console.error = (...args)=>{ errors.push(args.map(String).join(' '));original(...args); };
  globalThis.chrome = {
    storage:{sync:{get:async()=>({...settings}),set},local:{get:async()=>({}),set:async()=>{}},onChanged:{addListener:fn=>listeners.push(fn)}},
    runtime:{getURL:p=>new URL(p,root).href,sendMessage:async message=>{
      calls.push(message);
      if (window.RELEASE_TEST.fail) return {ok:false,error:'Simulated API outage'};
      if(message.type==='LOOKUP_COURSE') return {ok:true,result:{gpa:3.1,dropRate:10.3,link:'#course'}};
      const hit = data[message.payload.professorName];
      return {ok:true,result:hit ? {name:message.payload.professorName,courseCode:message.payload.courseCode,
        rmp:settings.showRmp === false ? null : hit.rmp,cougarGrades:settings.showCougarGrades === false ? null : hit.cougarGrades} : null};
    }}
  };
})();
