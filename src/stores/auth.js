import { defineStore } from 'pinia'
import { ref } from 'vue'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/firebase'
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null), profile = ref(null), loading = ref(true)
  let ready, stopProfile
  const valid = p => p && p.active !== false && ['admin','superAdmin'].includes(p.role)
  const canAccess = sector => ['admin','superAdmin'].includes(profile.value?.role)
  async function logout() { stopProfile?.(); profile.value=null; user.value=null; await signOut(auth) }
  function initAuth() {
    if (ready) return ready
    ready = new Promise(resolve => {
      onAuthStateChanged(auth, async account => {
        stopProfile?.(); user.value=null; profile.value=null
        if (account) {
          try {
            const snapshot = await getDoc(doc(db,'users',account.uid))
            if (!valid(snapshot.data())) throw new Error('Profil absent ou désactivé.')
            user.value=account; profile.value={...snapshot.data(),uid:account.uid,email:account.email}
            stopProfile=onSnapshot(doc(db,'users',account.uid), snap=> {
              if (!valid(snap.data())) { logout(); return }
              profile.value={...snap.data(),uid:account.uid,email:account.email}
            }, ()=>logout())
          } catch { await signOut(auth) }
        }
        loading.value=false; resolve()
      })
    })
    return ready
  }
  async function login(email,password) {
    const credential=await signInWithEmailAndPassword(auth,email,password)
    try {
      const snap=await getDoc(doc(db,'users',credential.user.uid))
      if (!valid(snap.data())) throw new Error('Profil absent ou compte désactivé. Contactez votre administrateur.')
      user.value=credential.user; profile.value={...snap.data(),uid:credential.user.uid,email}
      return profile.value
    } catch (error) { await logout(); throw error }
  }
  return {user,profile,loading,canAccess,initAuth,login,logout}
})
