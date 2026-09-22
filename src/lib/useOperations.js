import { ref, watch, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/firebase'
import { errorText } from './api'
import { hydrateOperations } from './hydrateOperations'
export function useOperations(filters, ownUid = null) {
  const rows=ref([]), loading=ref(true), error=ref('')
  let stop, generation=0
  watch(filters, value=> {
    stop?.(); ++generation; rows.value=[]; loading.value=true; error.value=''
    if (!value.start || !value.end || value.start > value.end) { error.value='Choisissez une période valide : la date de début doit précéder la date de fin.'; loading.value=false; return }
    const constraints=[]
    if (ownUid) constraints.push(where('operatorId','==',ownUid))
    if (value.start) constraints.push(where('date','>=',value.start))
    if (value.end) constraints.push(where('date','<=',value.end))
    constraints.push(orderBy('date','desc'))
    stop=onSnapshot(query(collection(db,'entries'),...constraints), async snapshot=> {
      const emission=++generation
      try {
        const result=await hydrateOperations(snapshot, !ownUid)
        if(emission!==generation)return
        rows.value=result; loading.value=false
      } catch(e) { if(emission===generation) { rows.value=[];error.value=errorText(e);loading.value=false } }
    }, e=> { generation++;rows.value=[];error.value=errorText(e);loading.value=false })
  }, {immediate:true})
  onUnmounted(()=>{generation++;stop?.()})
  return {rows,loading,error}
}
