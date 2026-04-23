const SUPABASE_URL = "https://kibepwdosrjxbauxnjtn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpYmVwd2Rvc3JqeGJhdXhuanRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDczMzAsImV4cCI6MjA5MjQ4MzMzMH0._bfs8jCBRSKCkHJ6T-0SIl2j_TnGliAW6zw7OLl08Sk";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = localStorage.getItem("currentUser");

/* ── ADMIN ── */
const ADMIN_USER = "ermn";
function isAdmin() {
  return currentUser && currentUser.toLowerCase() === ADMIN_USER.toLowerCase();
}

/* ── PROFANITY FILTER ── */
const BAD_WORDS = [
  "nigger","nigga","nigg3r","n1gger","n1gga","nig",
  "fuck","f*ck","fuk","fucc","fck","fvck","sh*t","shit","sh1t",
  "cunt","c*nt","dick","d1ck","d*ck","cock","c0ck",
  "pussy","pu$$y","bitch","b*tch","b1tch","whore","wh0re",
  "slut","sl*t","porn","p0rn","xxx","nude","nudes",
  "penis","p3nis","vagina","dildo","d1ldo","masturbat",
  "rape","r*pe","molest","pedophile","pedo","incest",
  "faggot","fag","f*g","dyke","d*ke","tranny","spic","sp*c","chink",
  "gook","kike","k*ke","wetback","coon","porch monkey",
  "towelhead","sandnigger","raghead","beaner","zipperhead",
  "bastard","dumbass","jackass","asshole","douchebag","motherfucker",
];
const BAD_REGEX = new RegExp(BAD_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"), "gi");

function containsBadWord(text) { BAD_REGEX.lastIndex=0; return BAD_REGEX.test(text); }
function filterText(text) { BAD_REGEX.lastIndex=0; return text.replace(BAD_REGEX, m => "*".repeat(m.length)); }

/* ── THEME ── */
function applyTheme() {
  const t = localStorage.getItem("theme") || "classic";
  const themes = {
    classic:   { body:"linear-gradient(180deg,#dfe7f3 0%,#f0f2f5 100%)",card:"#fff",topbar:"#3b5998",text:"#333",border:"#b0b7c3",accent:"#3b5998" },
    bubblegum: { body:"linear-gradient(180deg,#ffe4f3 0%,#fff0fb 100%)",card:"#fff5fb",topbar:"#e91e8c",text:"#5a0030",border:"#f9a8d4",accent:"#e91e8c" },
    midnight:  { body:"linear-gradient(180deg,#0a0a1a 0%,#12122a 100%)",card:"#1a1a2e",topbar:"#0d0d1f",text:"#c8d0e8",border:"#2a2a4a",accent:"#7b68ee" },
    y2k:       { body:"linear-gradient(180deg,#c0e8ff 0%,#e8f4ff 100%)",card:"#fff",topbar:"#0055cc",text:"#002266",border:"#99bbff",accent:"#0055cc" },
    limeade:   { body:"linear-gradient(180deg,#e8fce8 0%,#f5fff5 100%)",card:"#f9fff9",topbar:"#2d7a2d",text:"#1a3d1a",border:"#a3d9a3",accent:"#2d7a2d" },
  };
  const th = themes[t] || themes.classic;
  document.documentElement.style.setProperty("--body-bg", th.body);
  document.documentElement.style.setProperty("--card-bg", th.card);
  document.documentElement.style.setProperty("--topbar-bg", th.topbar);
  document.documentElement.style.setProperty("--text", th.text);
  document.documentElement.style.setProperty("--border", th.border);
  document.documentElement.style.setProperty("--accent", th.accent);
  document.body.style.background = th.body;
}

/* ── POST ── */
async function post() {
  const textEl = document.getElementById("text");
  const t = (textEl.value || "").trim();
  if (!t) return;
  if (!currentUser) { alert("Not logged in."); return; }
  if (containsBadWord(t)) { alert("Your post contains prohibited language and cannot be submitted."); return; }
  const btn = document.getElementById("postBtn");
  if (btn) btn.disabled = true;
  const { error } = await sb.from("posts").insert({ username: currentUser, text: t });
  if (btn) btn.disabled = false;
  if (error) { alert("Error posting: " + error.message); return; }
  textEl.value = "";
  await render();
}

/* ── LIKE ── */
async function like(postId) {
  if (!currentUser) return;
  const { data: existing } = await sb.from("likes").select("post_id").eq("post_id",postId).eq("username",currentUser).maybeSingle();
  if (existing) { await sb.from("likes").delete().eq("post_id",postId).eq("username",currentUser); }
  else { await sb.from("likes").insert({ post_id:postId, username:currentUser }); }
  const el = document.getElementById("likes-"+postId);
  if (el) {
    const { count } = await sb.from("likes").select("*",{count:"exact",head:true}).eq("post_id",postId);
    const { data: mine } = await sb.from("likes").select("post_id").eq("post_id",postId).eq("username",currentUser).maybeSingle();
    el.innerHTML = '<span class="heart'+(mine?" liked":"")+'" onclick="like('+postId+')">&#9829;</span> '+(count||0)+' likes';
  }
}

/* ── FOLLOW ── */
async function follow(targetUser) {
  if (!currentUser || targetUser===currentUser) return;
  const { data: existing } = await sb.from("follows").select("follower").eq("follower",currentUser).eq("following",targetUser).maybeSingle();
  if (existing) { await sb.from("follows").delete().eq("follower",currentUser).eq("following",targetUser); }
  else { await sb.from("follows").insert({ follower:currentUser, following:targetUser }); }
  await render();
}

/* ── DELETE own post ── */
async function del(postId) {
  if (!confirm("Delete this post?")) return;
  await sb.from("likes").delete().eq("post_id",postId);
  await sb.from("comments").delete().eq("post_id",postId);
  await sb.from("reports").delete().eq("post_id",postId);
  await sb.from("posts").delete().eq("id",postId).eq("username",currentUser);
  await render();
}

/* ── ADMIN: delete any post ── */
async function adminDelPost(postId) {
  if (!isAdmin()) return;
  if (!confirm("Admin: permanently delete this post?")) return;
  await sb.from("likes").delete().eq("post_id",postId);
  await sb.from("comments").delete().eq("post_id",postId);
  await sb.from("reports").delete().eq("post_id",postId);
  await sb.from("posts").delete().eq("id",postId);
  await render();
}

/* ── ADMIN: ban user ── */
async function adminBanUser(username) {
  if (!isAdmin()) return;
  if (username.toLowerCase()===ADMIN_USER.toLowerCase()) { alert("Cannot ban admin."); return; }
  if (!confirm("Admin: ban @"+username+"? This deletes all their content and blocks login.")) return;
  const { data: userPosts } = await sb.from("posts").select("id").eq("username",username);
  if (userPosts && userPosts.length) {
    const ids = userPosts.map(p=>p.id);
    await sb.from("likes").delete().in("post_id",ids);
    await sb.from("comments").delete().in("post_id",ids);
    await sb.from("reports").delete().in("post_id",ids);
  }
  await sb.from("posts").delete().eq("username",username);
  await sb.from("comments").delete().eq("username",username);
  await sb.from("likes").delete().eq("username",username);
  await sb.from("follows").delete().eq("follower",username);
  await sb.from("follows").delete().eq("following",username);
  await sb.from("banned_users").upsert({ username: username.toLowerCase() });
  await render();
  alert("@"+username+" has been banned.");
}

/* ── ADMIN: delete any comment ── */
async function adminDelComment(commentId, postId) {
  if (!isAdmin()) return;
  if (!confirm("Admin: delete this comment?")) return;
  await sb.from("comments").delete().eq("id",commentId);
  await loadComments(postId);
}

/* ── REPORT ── */
async function reportPost(postId, postUsername) {
  if (!currentUser) { alert("Log in to report posts."); return; }
  const reason = prompt("Report this post to admin?\nOptionally describe the issue:");
  if (reason === null) return;
  const { data: existing } = await sb.from("reports").select("id").eq("post_id",postId).eq("reporter",currentUser).maybeSingle();
  if (existing) { alert("You already reported this post."); return; }
  await sb.from("reports").insert({ post_id:postId, reporter:currentUser, reported_user:postUsername, reason:reason||"No reason given" });
  alert("Report submitted. Thank you.");
}

/* ── COMMENTS ── */
async function toggleComments(postId) {
  const box = document.getElementById("comments-"+postId);
  if (!box) return;
  if (box.style.display==="none" || !box.dataset.loaded) {
    box.style.display = "block";
    if (!box.dataset.loaded) { box.dataset.loaded="1"; await loadComments(postId); }
  } else { box.style.display = "none"; }
}

async function loadComments(postId) {
  const box = document.getElementById("comments-"+postId);
  if (!box) return;
  const { data: comments } = await sb.from("comments").select("id,username,text,created_at").eq("post_id",postId).order("created_at",{ascending:true});
  const list = box.querySelector(".comment-list");
  list.innerHTML = "";
  for (const c of (comments||[])) {
    const d = document.createElement("div");
    d.className = "comment";
    const canDelOwn = c.username===currentUser;
    const canDelAdmin = isAdmin() && !canDelOwn;
    d.innerHTML =
      '<a class="user-link" href="userpage.html?user='+encodeURIComponent(c.username)+'">@'+escapeHtml(c.username)+'</a> '+
      '<span>'+escapeHtml(filterText(c.text))+'</span>'+
      (canDelOwn ? ' <span class="del-comment" onclick="delComment('+c.id+','+postId+')">✕</span>' : '')+
      (canDelAdmin ? ' <span class="del-comment" style="color:#e55" title="Admin delete" onclick="adminDelComment('+c.id+','+postId+')">🛡✕</span>' : '');
    list.appendChild(d);
  }
}

async function addComment(postId) {
  const inp = document.getElementById("cinput-"+postId);
  if (!inp) return;
  const t = inp.value.trim();
  if (!t||!currentUser) return;
  if (containsBadWord(t)) { alert("Your comment contains prohibited language."); return; }
  inp.value = "";
  const { error } = await sb.from("comments").insert({ post_id:postId, username:currentUser, text:t });
  if (error) { alert("Error: "+error.message); return; }
  await loadComments(postId);
}

async function delComment(commentId, postId) {
  await sb.from("comments").delete().eq("id",commentId).eq("username",currentUser);
  await loadComments(postId);
}

/* ── UPLOAD PIC ── */
async function upload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const { error } = await sb.from("users").update({ pic:reader.result }).eq("username",currentUser);
    if (error) { alert("Error uploading pic: "+error.message); return; }
    const rp = document.getElementById("rightPic");
    if (rp) rp.src = reader.result;
    await render();
  };
  reader.readAsDataURL(file);
}

/* ── ESCAPE ── */
function escapeHtml(str) {
  return (str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* ── TIME AGO ── */
function timeAgo(dateStr) {
  const diff = Math.floor((Date.now()-new Date(dateStr))/1000);
  if (diff<60) return diff+"s ago";
  if (diff<3600) return Math.floor(diff/60)+"m ago";
  if (diff<86400) return Math.floor(diff/3600)+"h ago";
  return Math.floor(diff/86400)+"d ago";
}

/* ── RENDER FEED ── */
async function render(searchQuery, sortMode) {
  const feedEl = document.getElementById("posts");
  if (!feedEl) return;

  let query = sb.from("posts").select("id,username,text,created_at");
  if (searchQuery && searchQuery.trim()) {
    query = query.ilike("text", "%"+searchQuery.trim()+"%");
  }
  if (sortMode==="oldest") {
    query = query.order("created_at",{ascending:true});
  } else {
    query = query.order("created_at",{ascending:false});
  }

  const { data: posts, error } = await query;
  if (error) { feedEl.innerHTML = "<p>Error loading posts.</p>"; return; }

  const [{ data: myLikes },{ data: myFollows },{ data: allLikes },{ data: allUsers }] = await Promise.all([
    sb.from("likes").select("post_id").eq("username",currentUser),
    sb.from("follows").select("following").eq("follower",currentUser),
    sb.from("likes").select("post_id"),
    sb.from("users").select("username,pic,bio"),
  ]);

  const postIds = (posts||[]).map(p=>p.id);
  const { data: commentCounts } = postIds.length ? await sb.from("comments").select("post_id").in("post_id",postIds) : { data:[] };
  const commentMap = {};
  (commentCounts||[]).forEach(c=>{ commentMap[c.post_id]=(commentMap[c.post_id]||0)+1; });

  const likedSet = new Set((myLikes||[]).map(l=>l.post_id));
  const followSet = new Set((myFollows||[]).map(f=>f.following));
  const likeMap = {};
  (allLikes||[]).forEach(l=>{ likeMap[l.post_id]=(likeMap[l.post_id]||0)+1; });
  const userMap = {};
  (allUsers||[]).forEach(u=>{ userMap[u.username]=u; });

  let sortedPosts = posts||[];
  if (sortMode==="popular") {
    sortedPosts = [...sortedPosts].sort((a,b)=>(likeMap[b.id]||0)-(likeMap[a.id]||0));
  }

  const openComments = {};
  feedEl.querySelectorAll(".comment-box").forEach(box=>{
    if (box.style.display!=="none") openComments[box.dataset.postid]=true;
  });

  feedEl.innerHTML = "";

  if (!sortedPosts.length) {
    feedEl.innerHTML = "<div style='text-align:center;padding:24px;color:#888;font-style:italic;'>No posts found.</div>";
    return;
  }

  for (const p of sortedPosts) {
    const liked = likedSet.has(p.id);
    const likeCount = likeMap[p.id]||0;
    const commentCount = commentMap[p.id]||0;
    const isFollowing = followSet.has(p.username);
    const uInfo = userMap[p.username]||{};
    const pic = uInfo.pic||"";
    const isOpen = openComments[p.id];
    const isOwn = p.username===currentUser;
    const admin = isAdmin();

    const adminBar = admin
      ? '<div class="admin-bar">'+
          '<span class="admin-action" onclick="adminDelPost('+p.id+')">🛡 Delete Post</span>'+
          (!isOwn ? '<span class="admin-action" onclick="adminBanUser(\''+p.username.replace(/'/g,"\\'")+'\')" style="color:#e55">🛡 Ban @'+escapeHtml(p.username)+'</span>' : '')+
        '</div>'
      : '';

    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML =
      '<div class="post-header">'+
        '<a href="userpage.html?user='+encodeURIComponent(p.username)+'" class="post-avatar-link">'+
          '<img class="post-avatar" src="'+escapeHtml(pic)+'" onerror="this.src=\'empty.jpg\'">'+
        '</a>'+
        '<div class="post-meta">'+
          '<a href="userpage.html?user='+encodeURIComponent(p.username)+'" class="user-link">@'+escapeHtml(p.username)+'</a>'+
          (p.username!==currentUser
            ? ' <button class="follow-btn '+(isFollowing?"following":"")+'" onclick="follow(\''+p.username+'\')\">'+(isFollowing?"✓ Following":"+ Follow")+'</button>'
            : ' <span class="you-tag">you</span>')+
          '<div class="post-time">'+timeAgo(p.created_at)+'</div>'+
        '</div>'+
        (isOwn ? '<span class="delete" onclick="del('+p.id+')">✕</span>' : '')+
      '</div>'+
      '<div class="post-text">'+escapeHtml(filterText(p.text))+'</div>'+
      '<div class="post-actions">'+
        '<span id="likes-'+p.id+'" class="like-wrap"><span class="heart'+(liked?" liked":"")+'" onclick="like('+p.id+')">&#9829;</span> '+likeCount+' likes</span>'+
        '<span class="comment-toggle" onclick="toggleComments('+p.id+')">&#128172; '+commentCount+' comments</span>'+
        (!isOwn ? '<span class="report-btn" onclick="reportPost('+p.id+',\''+p.username.replace(/'/g,"\\'")+'\')" title="Report this post">⚑ Report</span>' : '')+
      '</div>'+
      adminBar+
      '<div id="comments-'+p.id+'" class="comment-box" data-postid="'+p.id+'" style="display:'+(isOpen?"block":"none")+'">'+
        '<div class="comment-list"></div>'+
        '<div class="comment-input">'+
          '<input id="cinput-'+p.id+'" placeholder="Write a comment..." onkeydown="if(event.key===\'Enter\')addComment('+p.id+')">'+
          '<button onclick="addComment('+p.id+')">Post</button>'+
        '</div>'+
      '</div>';
    feedEl.appendChild(div);
    if (isOpen) loadComments(p.id);
  }

  // Sidebar
  const me = userMap[currentUser]||{};
  const { count: myFollowers } = await sb.from("follows").select("*",{count:"exact",head:true}).eq("following",currentUser);
  const { count: myFollowing } = await sb.from("follows").select("*",{count:"exact",head:true}).eq("follower",currentUser);

  const rp=document.getElementById("rightPic"), rn=document.getElementById("rightName");
  const rf=document.getElementById("rightFollowers"), rb=document.getElementById("rightBio");
  if (rp) rp.src = me.pic||"empty.jpg";
  if (rn) rn.innerHTML = '<a href="userpage.html?user='+encodeURIComponent(currentUser)+'" style="color:var(--accent);text-decoration:none;">@'+currentUser+'</a>'+(isAdmin()?' <span class="admin-badge">ADMIN</span>':'');
  if (rf) rf.innerHTML = '<span>'+(myFollowers||0)+' followers</span> · <span>'+(myFollowing||0)+' following</span>';
  if (rb) rb.innerText = me.bio||"";
}
