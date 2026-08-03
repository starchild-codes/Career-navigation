export const activeCounsellorId=()=>localStorage.getItem('cc-active-counsellor')||'maya-singh'
const request=async(path:string,init?:RequestInit)=>{const r=await fetch(path,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});if(!r.ok)throw new Error('Counsellor data service unavailable');return r.json()}
export const listPrivate=async(type:string)=>request(`/api/counsellor-records?counsellor_id=${encodeURIComponent(activeCounsellorId())}&type=${encodeURIComponent(type)}`)
export const savePrivate=async(type:string,key:string,payload:unknown)=>request('/api/counsellor-records',{method:'PUT',body:JSON.stringify({counsellor_id:activeCounsellorId(),type,key,payload})})
export const deletePrivate=async(type:string,key:string)=>request(`/api/counsellor-records?counsellor_id=${encodeURIComponent(activeCounsellorId())}&type=${encodeURIComponent(type)}&key=${encodeURIComponent(key)}`,{method:'DELETE'})
