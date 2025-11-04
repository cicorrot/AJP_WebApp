/* -----------------------------------------------------------------------------
   BLE Mapping
----------------------------------------------------------------------------- */
const NAME_PREFIX = 'CICOR';
const SERVICE_UUID = '0000fe40-cc7a-482a-984a-7f2ed5b3e58f';
const CH_BTN1_UUID = '0000fe42-8e22-4541-9d4c-21edae82ed01';
const CH_BTN2_UUID = '0000fe42-8e22-4541-9d4c-21edae82ed02';
const CH_BTN3_UUID = '0000fe42-8e22-4541-9d4c-21edae82ed03';
const CH_SWV_UUID  = '0000fe42-8e22-4541-9d4c-21edae82ed04';
const CH_TEMP_UUID = '0000fe42-8e22-4541-9d4c-21edae82ed05';
const CH_LED_UUID  = '0000fe41-8e22-4541-9d4c-21edae82ed19';
const CH_RED  = 0x01;
const CH_BLUE = 0x02;
const CH_GRN  = 0x03;

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.platform)
            || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

/* -----------------------------------------------------------------------------
   DOM
----------------------------------------------------------------------------- */
const logEl   = document.getElementById('log');
const deviceNameEl = document.getElementById('deviceName');
const connStateEl  = document.getElementById('connState');
const connectBtn   = document.getElementById('connectBtn');
const disconnectBtn= document.getElementById('disconnectBtn');
const b1 = document.getElementById('b1');
const b2 = document.getElementById('b2');
const b3 = document.getElementById('b3');
const pad1 = document.getElementById('pad1');
const pad2 = document.getElementById('pad2');
const pad3 = document.getElementById('pad3');
const ledCircle = document.getElementById('ledCircle');
const ledPreview = document.getElementById('ledPreview');
const ledR = document.getElementById('ledR');
const ledG = document.getElementById('ledG');
const ledB = document.getElementById('ledB');
const colorPicker = document.getElementById('colorPicker');
const allOffBtn = document.getElementById('allOff');
const swVersionEl = document.getElementById('swVersion');
const tempEl = document.getElementById('temp');
const iosHelper = document.getElementById('iosHelper');
const btnLedR = document.getElementById('btnLedR');
const btnLedG = document.getElementById('btnLedG');
const btnLedB = document.getElementById('btnLedB');


let device = null, server = null, service = null;
let chBtn1 = null, chBtn2 = null, chBtn3 = null, chSwv = null, chTemp = null, chLed = null;

/* -----------------------------------------------------------------------------
   Wake Lock (Screen on) — Variante A
----------------------------------------------------------------------------- */
let wakeLock = null;
let wakeRequested = false; // merkt sich, ob der User es wollte (Connect gedrückt)

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    log('Wake Lock API not supported — screen may sleep.');
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeRequested = true;
    log('Wake Lock active (screen will stay on).');

    // Falls das System den Wake Lock entzieht (z. B. App in Hintergrund, Akku kritisch)
    wakeLock.addEventListener('release', () => {
      log('Wake Lock released by system.');
      wakeLock = null;
    });
  } catch (err) {
    log('Wake Lock request failed:', err.name || err.message || err);
  }
}

async function releaseWakeLock() {
  wakeRequested = false;
  try { await wakeLock?.release(); } catch {}
  wakeLock = null;
  log('Wake Lock released (by app).');
}

// Wenn die Seite wieder sichtbar wird und der User WakeLock wollte → erneut anfordern
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeRequested && !wakeLock) {
    requestWakeLock();
  }
});

/* -----------------------------------------------------------------------------
   Helpers
----------------------------------------------------------------------------- */
function log(...msg){
  const t = new Date().toLocaleTimeString();
  const line = `${t} — ${msg.join(' ')}`;
  logEl.innerHTML = `<br>${line}` + logEl.innerHTML;
}

function setConn(online, name){
  deviceNameEl.textContent = name || (online ? 'Connected' : 'Not connected');
  connStateEl.textContent = online ? 'Status: connected' : 'Status: offline';
  connectBtn.disabled = online; disconnectBtn.disabled = !online;
}
function setPad(padEl, on){ on ? padEl.classList.add('active') : padEl.classList.remove('active'); }
function currentColor(){
  const r = ledR.checked ? 255 : 0;
  const g = ledG.checked ? 255 : 0;
  const b = ledB.checked ? 255 : 0;
  return `rgb(${r},${g},${b})`;
}
function updateLedVisual(){
  const col = currentColor();
  ledCircle.setAttribute('fill', col);
  ledPreview.style.background = col;
}
function updateLedButtons(){
  btnLedR?.classList.toggle('on', ledR.checked);
  btnLedG?.classList.toggle('on', ledG.checked);
  btnLedB?.classList.toggle('on', ledB.checked);
}

/* -----------------------------------------------------------------------------
   BLE Connect/Disconnect
----------------------------------------------------------------------------- */
async function connectBLE(){
  try{
    if(!navigator.bluetooth){
      log('Web Bluetooth not available.');
      if(IS_IOS){ iosHelper.style.display = 'block'; }
      return;
    }
    log('Searching for device…');
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: NAME_PREFIX }],
      optionalServices: [SERVICE_UUID]
    });
    device.addEventListener('gattserverdisconnected', onDisconnected);
    deviceNameEl.textContent = device.name || device.id || 'Device';
    log('Selected:', device.name || device.id);

    server  = await device.gatt.connect();
    setConn(true, device.name || device.id);
    log('GATT connected, loading service/characteristics…');

    service = await server.getPrimaryService(SERVICE_UUID);
    const chars = await service.getCharacteristics();

    chBtn1 = chars.find(c=>c.uuid.toLowerCase()===CH_BTN1_UUID);
    chBtn2 = chars.find(c=>c.uuid.toLowerCase()===CH_BTN2_UUID);
    chBtn3 = chars.find(c=>c.uuid.toLowerCase()===CH_BTN3_UUID);
    chSwv  = chars.find(c=>c.uuid.toLowerCase()===CH_SWV_UUID);
    chTemp = chars.find(c=>c.uuid.toLowerCase()===CH_TEMP_UUID);
    chLed  = chars.find(c=>c.uuid.toLowerCase()===CH_LED_UUID);

    await startNotifications();
    log('Ready.');
  }catch(e){
    log('Error while connecting:', e.message || e);
    setConn(false);
  }
}
function onDisconnected(){
  log('Device disconnected');
  setConn(false);
  clearHandles();
  // Sicherheit: bei Disconnect den WakeLock freigeben
  releaseWakeLock();
}
function clearHandles(){ chBtn1=chBtn2=chBtn3=chSwv=chTemp=chLed=null; }
async function disconnect(){
  try{
    if(device && device.gatt.connected){ device.gatt.disconnect(); }
  }catch{}
  setConn(false);
  log('Disconnected.');
  // WakeLock freigeben, wenn der Nutzer trennt
  releaseWakeLock();
}

/* -----------------------------------------------------------------------------
   Notifications
----------------------------------------------------------------------------- */
async function startNotifications(){
  const onBtn = (elTxt, padEl) => e => {
    try{
      const v = e.target.value.getUint8(1);
      elTxt.textContent = v===1 ? 'pressed' : 'released';
      setPad(padEl, v===1);
    }catch(err){ log('Notification parse error:', err.message); }
  };
  if(chBtn1){ await chBtn1.startNotifications(); chBtn1.addEventListener('characteristicvaluechanged', onBtn(b1,pad1), {passive:true}); }
  if(chBtn2){ await chBtn2.startNotifications(); chBtn2.addEventListener('characteristicvaluechanged', onBtn(b2,pad2), {passive:true}); }
  if(chBtn3){ await chBtn3.startNotifications(); chBtn3.addEventListener('characteristicvaluechanged', onBtn(b3,pad3), {passive:true}); }

  if(chSwv){
    await chSwv.startNotifications();
    chSwv.addEventListener('characteristicvaluechanged', e=>{
      const dec = new TextDecoder();
      swVersionEl.textContent = dec.decode(e.target.value.buffer || e.target.value);
    }, {passive:true});
  }
}

/* -----------------------------------------------------------------------------
   LED control
----------------------------------------------------------------------------- */
async function writeLedChannel(channel, on){
  updateLedVisual();
  updateLedButtons();
  if(!chLed){ log('LED characteristic not found — UI updated only.'); return; }
  try{
    const payload = new Uint8Array([0x00, channel, on ? 0x01 : 0x00]);
    await chLed.writeValue(payload);
    log(`LED ch=${channel} -> ${on ? 'on' : 'off'}`);
  }catch(e){ log('LED write error:', e.message); }
}
function syncFromCheckboxes(){
  writeLedChannel(CH_RED,  ledR.checked);
  writeLedChannel(CH_GRN,  ledG.checked);
  writeLedChannel(CH_BLUE, ledB.checked);
}
function setFromColor(hex){
  const r = parseInt(hex.slice(1,3),16) > 127;
  const g = parseInt(hex.slice(3,5),16) > 127;
  const b = parseInt(hex.slice(5,7),16) > 127;
  ledR.checked = r; ledG.checked = g; ledB.checked = b;
  updateLedVisual();
  updateLedButtons();
  syncFromCheckboxes();
}

/* -----------------------------------------------------------------------------
   Events & Boot
----------------------------------------------------------------------------- */
// Wichtig: Wir ersetzen die bisherigen Click-Handler, damit wir beim Connect
// zuerst (im User-Gesture) den WakeLock anfordern:
connectBtn.addEventListener('click', async () => {
  await requestWakeLock();  // versucht den Bildschirm wach zu halten
  connectBLE();             // dann verbinden
}, {passive:true});

disconnectBtn.addEventListener('click', () => {
  disconnect();             // trennt und gibt WakeLock frei
}, {passive:true});

btnLedR?.addEventListener('click', ()=>{
  ledR.checked = !ledR.checked;
  syncFromCheckboxes();
  updateLedButtons();
}, {passive:true});

btnLedG?.addEventListener('click', ()=>{
  ledG.checked = !ledG.checked;
  syncFromCheckboxes();
  updateLedButtons();
}, {passive:true});

btnLedB?.addEventListener('click', ()=>{
  ledB.checked = !ledB.checked;
  syncFromCheckboxes();
  updateLedButtons();
}, {passive:true});

ledR.addEventListener('change', ()=>{ syncFromCheckboxes(); updateLedButtons(); }, {passive:true});
ledG.addEventListener('change', ()=>{ syncFromCheckboxes(); updateLedButtons(); }, {passive:true});
ledB.addEventListener('change', ()=>{ syncFromCheckboxes(); updateLedButtons(); }, {passive:true});


allOffBtn.addEventListener('click', ()=>{
  ledR.checked = ledG.checked = ledB.checked = false;
  syncFromCheckboxes();
  updateLedButtons();
}, {passive:true});

const sim = (box, pad)=>{
  box.textContent='pressed'; setPad(pad,true);
  setTimeout(()=>{ box.textContent='released'; setPad(pad,false); },700);
};
document.getElementById('simB1').addEventListener('pointerdown', ()=>sim(b1,pad1), {passive:true});
document.getElementById('simB2').addEventListener('pointerdown', ()=>sim(b2,pad2), {passive:true});
document.getElementById('simB3').addEventListener('pointerdown', ()=>sim(b3,pad3), {passive:true});

setConn(false);
updateLedVisual();
updateLedButtons();
if(IS_IOS && !('bluetooth' in navigator)){ iosHelper.style.display = 'block'; }
log('UI ready. PWA + Service Worker active.');

/* PWA: Service Worker registration (path as in the example) */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(reg => console.log("SW registered:", reg.scope))
      .catch(err => console.warn("SW error:", err));
  });
}
