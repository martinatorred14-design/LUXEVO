// LUXEVO account system — real email/password authentication via Firebase.
// Works as a static website on GitHub Pages after firebase-config.js is configured.
// No hardcoded users and no passwords in source control or localStorage.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const el = id => document.getElementById(id);
const ui = window.LUXEVOAuthUI;
const form = el('auth-form');
const action = el('auth-action');
const email = el('auth-email');
const password = el('auth-password');
const confirm = el('auth-confirm');
const submit = el('auth-submit');
const errorBox = el('auth-error');
const noticeBox = el('auth-notice');
let auth = null;
let mode = 'login';
let busy = false;
let account = null;
let ready = false;

function showError(message){ errorBox.textContent = message; errorBox.hidden = false; noticeBox.hidden = true; }
function showNotice(message){ noticeBox.textContent = message; noticeBox.hidden = false; errorBox.hidden = true; }
function clearFeedback(){ errorBox.hidden = true; noticeBox.hidden = true; }
function messageFor(error){
  switch(error?.code){
    case 'auth/email-already-in-use': return 'This email already has an account. Select Log in instead.';
    case 'auth/invalid-email': return 'Enter a valid email address.';
    case 'auth/weak-password': return 'Choose a stronger password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Incorrect email or password. Please try again.';
    case 'auth/too-many-requests': return 'Too many attempts. Please try again later or reset your password.';
    case 'auth/network-request-failed': return 'Network error. Check your internet connection.';
    case 'auth/operation-not-allowed': return 'Email/Password sign-in must be enabled in Firebase Authentication.';
    case 'auth/unauthorized-domain': return 'Add your website domain in Firebase Authentication > Settings > Authorized domains.';
    case 'auth/invalid-api-key': return 'Check the Firebase web configuration in firebase-config.js.';
    default: return 'We could not complete this request. Please try again.';
  }
}
function setMode(next){
  mode = next;
  form.reset();
  password.type = 'password';
  confirm.type = 'password';
  clearFeedback();
  const signup = next==='signup', reset=next==='reset';
  el('auth-tabs').hidden = reset;
  el('auth-password-wrap').hidden = reset;
  el('auth-confirm-wrap').hidden = !signup;
  el('auth-show-row').hidden = reset;
  el('auth-forgot').hidden = reset;
  el('auth-back-login').hidden = !reset;
  el('auth-login-tab').setAttribute('aria-selected',String(next==='login'));
  el('auth-signup-tab').setAttribute('aria-selected',String(signup));
  password.required = !reset;
  password.autocomplete = signup ? 'new-password':'current-password';
  password.minLength = signup ? 8 : 0;
  confirm.required = signup;
  el('auth-heading').textContent = signup ? 'Join LUXEVO.' : reset ? 'Reset password.' : 'Welcome back.';
  el('auth-description').textContent = signup ? 'Register with your own email and password.' : reset ? 'We will email you a password reset link.' : 'Sign in with your LUXEVO account.';
  submit.textContent = signup ? 'Create account' : reset ? 'Send reset email' : 'Log in';
}
function setBusy(value){
  busy=value;
  submit.disabled=value;
  email.disabled=value;
  password.disabled=value;
  confirm.disabled=value;
  submit.textContent = value ? 'Please wait…' : mode==='signup'?'Create account':mode==='reset'?'Send reset email':'Log in';
}
function renderUser(){
  action.textContent = account ? 'Log out' : 'Log in';
  action.setAttribute('aria-label', account ? 'Log out of LUXEVO' : 'Log in to LUXEVO');
  action.setAttribute('aria-haspopup', account ? 'false':'dialog');
  el('auth-status').textContent = account?.email || 'Guest';
  el('auth-status').title = account?.email || 'Not signed in';
}
function openAuth(){
  setMode('login');
  ui.open();
  if(!ready) showError('Accounts are not configured yet. Add your Firebase web app settings to firebase-config.js and enable Email/Password authentication.');
  else email.focus();
}

// Product customizer requests sign-in only when a visitor clicks Customize.
document.addEventListener('luxevo:request-login', () => {
  if(account) return;
  openAuth();
  showNotice('Log in or create an account to customize your chosen device. Browsing is always free.');
});
window.LUXEVOAccount = Object.freeze({ getUser:() => account });

document.addEventListener('luxevo:auth-action', async ()=>{
  if(busy) return;
  if(account && auth){
    try{ await signOut(auth); ui.notify('You have logged out.'); }
    catch(err){ ui.notify(messageFor(err)); }
  }else openAuth();
});
el('auth-login-tab').addEventListener('click',()=>setMode('login'));
el('auth-signup-tab').addEventListener('click',()=>setMode('signup'));
el('auth-forgot').addEventListener('click',()=>{setMode('reset');email.focus();});
el('auth-back-login').addEventListener('click',()=>{setMode('login');email.focus();});
el('auth-show-password').addEventListener('change', e=>{
  const type=e.target.checked?'text':'password';
  password.type=type;confirm.type=type;
});
form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(busy) return;
  clearFeedback();
  if(!ready || !auth){showError('Set up Firebase before using customer accounts. See README.md.');return;}
  const address = email.value.trim();
  if(!email.validity.valid || !address){showError('Enter a valid email address.');email.focus();return;}
  if(mode!=='reset' && !password.value){showError('Enter your password.');password.focus();return;}
  if(mode==='signup'){
    if(password.value.length<8){showError('Use a password with at least 8 characters.');password.focus();return;}
    if(password.value!==confirm.value){showError('The passwords do not match.');confirm.focus();return;}
  }
  setBusy(true);
  try{
    if(mode==='reset'){
      await sendPasswordResetEmail(auth,address);
      form.reset();
      showNotice('If an account is associated with this email, a reset link will be sent. Please check your inbox.');
    }else if(mode==='signup'){
      await createUserWithEmailAndPassword(auth,address,password.value);
      form.reset(); ui.close(); ui.notify('Account created. Welcome to LUXEVO!'); document.dispatchEvent(new Event('luxevo:auth-success'));
    }else{
      await signInWithEmailAndPassword(auth,address,password.value);
      form.reset(); ui.close(); ui.notify('You are logged in to LUXEVO.'); document.dispatchEvent(new Event('luxevo:auth-success'));
    }
  }catch(err){showError(messageFor(err));}
  finally{setBusy(false);}
});

// Firebase is activated only after the site owner supplies their own web-app config.
const configured = Object.values(firebaseConfig).every(v=> typeof v==='string' && v.length>2 && !v.includes('REPLACE_WITH'));
if(configured){
  try{
    auth=getAuth(initializeApp(firebaseConfig));
    ready=true;
    onAuthStateChanged(auth,user=>{account=user;renderUser();document.dispatchEvent(new CustomEvent('luxevo:auth-state',{detail:{user: user ? {uid:user.uid,email:user.email}:null}}));},err=>{showError(messageFor(err));});
  }catch(err){console.error('Firebase initialization error:', err.code || err.name);}
}
window.LUXEVOAuthLoaded = true;
renderUser();
