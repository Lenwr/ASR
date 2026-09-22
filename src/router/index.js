import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '../stores/auth'
const router=createRouter({history:createWebHistory(),routes:[
  {path:'/',component:()=>import('../views/Login.vue')},
  {path:'/home',component:()=>import('../views/operator/Home.vue'),meta:{requiresAuth:true}},
  {path:'/parc',component:()=>import('../views/operator/Parc.vue'),meta:{requiresAuth:true,access:'parc'}},
  {path:'/atelier',component:()=>import('../views/operator/Atelier.vue'),meta:{requiresAuth:true,access:'atelier'}},
  {path:'/admin',component:()=>import('../views/admin/Dashboard.vue'),meta:{requiresAuth:true,roles:['admin']}},
  {path:'/history',component:()=>import('../views/admin/History.vue'),meta:{requiresAuth:true,roles:['admin']}},
  {path:'/services',component:()=>import('../views/admin/Settings.vue'),meta:{requiresAuth:true,roles:['admin']}},
  {path:'/users',component:()=>import('../views/admin/Settings.vue'),props:{users:true},meta:{requiresAuth:true,roles:['admin']}},
  {path:'/:pathMatch(.*)*',redirect:'/'}
]})
let observing=false
function allowed(to,store) {
  return (!to.meta.roles || to.meta.roles.includes(store.profile?.role)) && (!to.meta.access || store.canAccess(to.meta.access))
}
router.beforeEach(async to=>{
  const store=useAuthStore();await store.initAuth()
  if(!observing){observing=true;watch(()=>store.profile,()=>{if(router.currentRoute.value.meta.requiresAuth){if(!store.profile)router.replace('/');else if(!allowed(router.currentRoute.value,store))router.replace('/home')}})}
  if(to.meta.requiresAuth && (!store.user||!store.profile))return '/'
  if(to.path==='/'&&store.profile)return store.profile.role==='admin'?'/admin':'/home'
  if(!allowed(to,store))return '/home'
})
export default router
