/* ==========================
   Mini Task Manager JS
========================== */

const LS_KEY = "super_tasks_v2";
const LS_META = "super_meta_v1";
const THEME_KEY = "super_theme_v2";

let tasks = [];
let meta = { name: null, notifiedIds: [], dailyCompletions: {} };
let activeFilter = 'all';

/* ======== UI Elements ======== */
const el = {
    taskInput: document.getElementById("taskInput"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    taskList: document.getElementById("taskList"),
    progressBar: document.getElementById("progressBar"),
    progressText: document.getElementById("progressText"),
    message: document.getElementById("message"),
    counts: document.getElementById("counts"),
    streak: document.getElementById("streak"),
    category: document.getElementById("taskCategory"),
    priority: document.getElementById("taskPriority"),
    due: document.getElementById("taskDue"),
    search: document.getElementById("searchInput"),
    sort: document.getElementById("sortSelect"),
    clearAllBtn: document.getElementById("clearAllBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
    voiceBtn: document.getElementById("voiceBtn"),
    toggleTheme: document.getElementById("toggleTheme"),
    datetime: document.getElementById("datetime"),
    toast: document.getElementById("toast"),
    greeting: document.getElementById("greeting"),
    tip: document.getElementById("tip"),
};

/* ======== Utilities ======== */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function todayStr() { return new Date().toISOString().slice(0,10); }
function formatDateISO(d) { return d ? new Date(d).toLocaleDateString("en-GB") : ""; }

function showToast(txt, ms=2500){
    el.toast.textContent = txt;
    el.toast.classList.add("show");
    setTimeout(()=> el.toast.classList.remove("show"), ms);
}

function saveAll() {
    localStorage.setItem(LS_KEY, JSON.stringify(tasks));
    localStorage.setItem(LS_META, JSON.stringify(meta));
}

function loadAll() {
    try { tasks = JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(e){ tasks=[]; }
    try { meta = JSON.parse(localStorage.getItem(LS_META)) || meta; } catch(e){ meta=meta; }
}

/* ======== Dynamic Background & Theme ======== */
function updateBackgroundByTime() {
    const hour = new Date().getHours();
    const body = document.body;
    if(hour >= 6 && hour < 18){
        body.style.background = 'url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1350&q=80") no-repeat center/cover';
        body.classList.remove('dark');
    } else {
        body.style.background = 'url("https://images.unsplash.com/photo-1506784365847-bbad939e9335?auto=format&fit=crop&w=1350&q=80") no-repeat center/cover';
        body.classList.add('dark');
    }
}
updateBackgroundByTime();
setInterval(updateBackgroundByTime, 60000);

function loadTheme(){
    if(localStorage.getItem(THEME_KEY) === "dark") document.body.classList.add("dark");
}
function toggleTheme(){
    document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, document.body.classList.contains("dark")?"dark":"light");
}
el.toggleTheme.addEventListener("click", toggleTheme);
loadTheme();

/* ======== Clock ======== */
function updateDateTime(){
    const now = new Date();
    el.datetime.textContent = `${now.toLocaleTimeString()} | ${now.toLocaleDateString("en-GB")}`;
}
setInterval(updateDateTime,1000); updateDateTime();

/* ======== Greeting ======== */
function askNameIfNeeded(){
    if(meta.name) return;
    const n = prompt("Hi! What should I call you? (optional)");
    if(n){ meta.name = n.trim(); saveAll(); }
}
function renderGreeting(){ el.greeting.textContent = meta.name?`Welcome back, ${meta.name} 👋`:""; }

/* ======== Task CRUD ======== */
function addTaskFromUI(){
    const text = el.taskInput.value.trim();
    if(!text) return;
    const newTask = {
        id: uid(),
        text,
        category: el.category.value || "personal",
        priority: el.priority.value || "low",
        due: el.due.value || null,
        completed: false,
        created: Date.now(),
        alerted: false
    };
    tasks.push(newTask);
    saveAll(); renderTasks();
    el.taskInput.value=""; el.due.value="";
    showToast("Task added ✅");
}

function toggleTask(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    t.completed = !t.completed;
    if(t.completed) recordDailyCompletion();
    saveAll(); renderTasks();
}

function editTask(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    const newText = prompt("Edit task text:", t.text); if(newText===null) return;
    t.text = newText.trim() || t.text;
    const newCat = prompt("Category (work/study/personal):", t.category)||t.category;
    t.category = ["work","study","personal"].includes(newCat.toLowerCase())?newCat.toLowerCase():t.category;
    const newPr = prompt("Priority (low/medium/high):", t.priority)||t.priority;
    t.priority = ["low","medium","high"].includes(newPr.toLowerCase())?newPr.toLowerCase():t.priority;
    const newDue = prompt("Due date (YYYY-MM-DD) or empty:", t.due||""); t.due = newDue||null;
    saveAll(); renderTasks(); showToast("Task updated ✏️");
}

function deleteTask(id){
    if(!confirm("Delete this task?")) return;
    tasks = tasks.filter(x=>x.id!==id);
    saveAll(); renderTasks(); showToast("Deleted ❌");
}

/* ======== Render Tasks ======== */
function renderTasks(){
    const q = el.search.value.trim().toLowerCase();
    let list = [...tasks];

    if(activeFilter === 'today') list = list.filter(t => t.due === todayStr());
    else if(activeFilter !== 'all') list = list.filter(t => t.category === activeFilter);

    if(q) list = list.filter(t => 
        t.text.toLowerCase().includes(q) || 
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.priority && t.priority.toLowerCase().includes(q))
    );

    switch(el.sort.value){
        case "newest": list.sort((a,b)=> b.created - a.created); break;
        case "oldest": list.sort((a,b)=> a.created - b.created); break;
        case "deadline": list.sort((a,b)=> { if(!a.due) return 1; if(!b.due) return -1; return new Date(a.due)-new Date(b.due); }); break;
        case "completed": list.sort((a,b)=> (b.completed - a.completed) || (b.created - a.created)); break;
    }

    el.taskList.innerHTML = "";
    list.forEach(t=>{
        const li = document.createElement("li");
        li.className = "task-item" + (t.completed ? " completed" : "");

        const left = document.createElement("div"); left.className="task-left";
        const cb = document.createElement("input"); cb.type="checkbox"; cb.checked=t.completed;
        cb.addEventListener("change", ()=> toggleTask(t.id));
        const textSpan = document.createElement("span");
        textSpan.textContent = t.text + (t.due ? " — Due: "+formatDateISO(t.due) : "");
        left.appendChild(cb); left.appendChild(textSpan);

        const cat = document.createElement("span");
        cat.className = "category-tag "+(t.category||"personal");
        cat.textContent = t.category || "personal";
        left.appendChild(cat);

        const pr = document.createElement("span");
        pr.className = t.priority==="high"?"priority-high":t.priority==="medium"?"priority-med":"priority-low";
        pr.textContent = t.priority.charAt(0).toUpperCase()+t.priority.slice(1);
        left.appendChild(pr);

        const actions = document.createElement("div"); actions.className="task-actions";
        const editBtn = document.createElement("button"); editBtn.innerHTML="✏️"; editBtn.title="Edit"; editBtn.onclick=()=>editTask(t.id);
        const delBtn = document.createElement("button"); delBtn.innerHTML="❌"; delBtn.title="Delete"; delBtn.onclick=()=>deleteTask(t.id);
        actions.appendChild(editBtn); actions.appendChild(delBtn);

        li.appendChild(left); li.appendChild(actions);
        el.taskList.appendChild(li);

        if(t.due && !t.completed){
            const dueDate = new Date(t.due); const now = new Date();
            if(dueDate.setHours(0,0,0,0) < now.setHours(0,0,0,0)) li.style.border="1px solid rgba(255,80,80,0.8)";
        }
    });

    updateProgress(); updateTip();
}

/* ======== Progress / Stats ======== */
function updateProgress(){
    const total = tasks.length;
    const completed = tasks.filter(t=>t.completed).length;
    const pending = total-completed;
    const percent = total>0?Math.round((completed/total)*100):0;

    el.progressBar.style.width = percent+"%";
    el.progressText.textContent = percent+"% Completed";
    el.counts.textContent = `Total: ${total} | Completed: ${completed} | Pending: ${pending}`;

    if(percent===0) el.message.textContent="Start adding tasks 🚀";
    else if(percent<50) el.message.textContent="Keep Going — small steps build momentum ✨";
    else if(percent<100) el.message.textContent="Great Progress — you're doing well 💪";
    else { el.message.textContent="All Tasks Completed — celebrate! 🎉"; celebrateConfetti(); }

    el.streak.textContent = `Streak: ${computeStreak()} 🔥`;
}

/* ======== Streaks ======== */
function recordDailyCompletion(){
    const d = todayStr();
    meta.dailyCompletions[d] = (meta.dailyCompletions[d]||0)+1;
    saveAll();
}
function computeStreak(){
    const keys = Object.keys(meta.dailyCompletions).sort().reverse();
    if(keys.length===0) return 0;
    let streak=0; let cur = new Date();
    for(let i=0;;i++){
        const ds = new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()-i).toISOString().slice(0,10);
        if(meta.dailyCompletions[ds]>0) streak++; else break;
    }
    return streak;
}

/* ======== Tips ======== */
function updateTip(){
    const total = tasks.length;
    if(total===0){ el.tip.textContent="Tip: Add a task to get reminders."; return; }
    const high = tasks.filter(t=>t.priority==="high" && !t.completed).length;
    const soon = tasks.filter(t=>t.due && !t.completed && new Date(t.due)-new Date()<=48*3600*1000).length;
    if(high>2) el.tip.textContent=`Smart Tip: You have ${high} high-priority tasks. Focus on one at a time.`;
    else if(soon>0) el.tip.textContent=`Smart Tip: ${soon} task(s) due within 48 hours — prioritize them.`;
    else el.tip.textContent="Smart Tip: Keep your task list short and focused for productivity.";
}

/* ======== Confetti ======== */
function celebrateConfetti(){
    const colors=['#ff4d4f','#ffa940','#ffec3d','#36cfc9','#597ef7'];
    for(let i=0;i<40;i++){
        const elc=document.createElement("div"); elc.className="confetti-piece";
        elc.style.left=Math.random()*100+"vw";
        elc.style.background=colors[Math.floor(Math.random()*colors.length)];
        elc.style.transform=`rotate(${Math.random()*360}deg)`;
        elc.style.opacity=1; elc.style.top="-10vh";
        elc.style.animation=`confettiFall ${1.6+Math.random()}s linear forwards`;
        document.body.appendChild(elc);
        setTimeout(()=>elc.remove(),2500);
    }
}

/* ======== Filters ======== */
document.querySelectorAll(".filter-btn").forEach(b=>{
    b.addEventListener("click", ()=>{
        document.querySelectorAll(".filter-btn").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        activeFilter = b.dataset.filter;
        renderTasks();
    });
});

/* ======== Search / Sort ======== */
el.search.addEventListener("input", renderTasks);
el.sort.addEventListener("change", renderTasks);

/* ======== Add / Clear / Export / Import ======== */
el.addTaskBtn.addEventListener("click", addTaskFromUI);
el.taskInput.addEventListener("keydown", e=>{ if(e.key==="Enter") addTaskFromUI(); });
el.clearAllBtn.addEventListener("click", ()=>{
    if(!confirm("Clear all tasks?")) return;
    tasks=[]; saveAll(); renderTasks(); showToast("All cleared 🗑️");
});
el.exportBtn.addEventListener("click", ()=>{
    const blob=new Blob([JSON.stringify(tasks,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download="tasks-export.json"; a.click(); URL.revokeObjectURL(url); showToast("Exported 📂");
});
el.importFile.addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    const reader = new FileReader();
    reader.onload = evt => {
        try{
            const parsed = JSON.parse(evt.target.result);
            if(!Array.isArray(parsed)) throw new Error("Invalid JSON");
            parsed.forEach(t=>{ if(!t.id) t.id=uid(); if(!t.created) t.created=Date.now(); t.completed=!!t.completed; tasks.push(t); });
            saveAll(); renderTasks(); showToast("Import merged ✅");
        } catch(err){ alert("Import failed: "+err.message); }
    };
    reader.readAsText(f);
});

/* ======== Voice Input ======== */
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang='en-IN'; recognition.interimResults=false; recognition.maxAlternatives=1;
    el.voiceBtn.addEventListener("click", ()=>{
        el.voiceBtn.textContent="🎙️ Listening...";
        recognition.start();
    });
    recognition.onresult = e=>{
        const spoken=e.results[0][0].transcript; el.taskInput.value=spoken; el.voiceBtn.textContent="🎤"; addTaskFromUI();
    };
    recognition.onerror = e=>{ console.error(e); el.voiceBtn.textContent="🎤"; alert("Voice error: "+e.error); };
    recognition.onend = ()=>{ el.voiceBtn.textContent="🎤"; };
} else { el.voiceBtn.addEventListener("click", ()=> alert("Voice input not supported.")); }

/* ======== Startup ======== */
loadAll();
askNameIfNeeded();
renderGreeting();
renderTasks();
