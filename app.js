// Keys resolved by config.js
const SUPABASE_URL = window.ERMN_URL;
const SUPABASE_KEY = window.ERMN_KEY;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// Handle Auth State
async function initSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data: profile } = await sb.from("users").select("username, is_admin").eq("id", session.user.id).maybeSingle();
    if (profile) {
      currentUser = profile.username;
      _isAdmin = profile.is_admin;
      localStorage.setItem("currentUser", currentUser);
    } else {
      currentUser = session.user.user_metadata.username;
      localStorage.setItem("currentUser", currentUser);
    }
  } else {
    currentUser = localStorage.getItem("currentUser");
  }
  document.dispatchEvent(new Event("sessionReady"));
}
initSession();

/* ── EGRESS OPTIMISATION ── */
const POST_LIMIT = 20; // posts per page
const _picCache = {};  // username → pic data URL, persists for the session
let _currentPage = 0;  // 0-based page index

/* ── GLOBALS ── */
const ADMIN_USER = "ermn";

// Inject Badge Styles
const style = document.createElement('style');
style.textContent = `
  .badge-icon {
    display: inline-block;
    width: 14px;
    height: 14px;
    background-color: var(--accent);
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    vertical-align: middle;
    margin-left: 3px;
    cursor: pointer;
    position: relative;
  }
  .badge-icon::after {
    content: attr(data-title);
    position: absolute;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    z-index: 1000;
  }
  .badge-icon:hover::after {
    opacity: 1;
  }
  .badge-verified {
    -webkit-mask-image: url('verifiedbadge.png');
    mask-image: url('verifiedbadge.png');
  }
  .badge-developer {
    -webkit-mask-image: url('devbadge.png');
    mask-image: url('devbadge.png');
  }
`;
document.head.appendChild(style);

/* ── ADMIN ── */
let _isAdmin = false;
function isAdmin() {
  return _isAdmin;
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
  if (!currentUser) { await uiAlert("Not logged in."); return; }
  if (containsBadWord(t)) { await uiAlert("Your post contains prohibited language and cannot be submitted."); return; }
  const btn = document.getElementById("postBtn");
  if (btn) btn.disabled = true;
  
  // Insert the post
  const { data: insertedPost, error } = await sb.from("posts").insert({ username: currentUser, text: t }).select().single();
  if (error) { await uiAlert("Error posting: " + error.message); if (btn) btn.disabled = false; return; }
  
  // Check for poll options
  const pollOpts = [];
  for (let i=1; i<=4; i++) {
    const optEl = document.getElementById("pollOpt"+i);
    if (optEl && optEl.value.trim()) {
      pollOpts.push({ text: optEl.value.trim(), votes: 0 });
      optEl.value = "";
    }
  }
  if (pollOpts.length >= 2) {
    await sb.from("polls").insert({ post_id: insertedPost.id, options: pollOpts });
  }
  const pollContainer = document.getElementById("pollInputs");
  if (pollContainer) pollContainer.style.display = "none";
  
  if (btn) btn.disabled = false;
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
  if (existing) {
    await sb.from("follows").delete().eq("follower",currentUser).eq("following",targetUser);
  } else {
    // Check if private
    const { data: targetData } = await sb.from("users").select("is_private").eq("username", targetUser).maybeSingle();
    if (targetData && targetData.is_private) {
      const { data: existingReq } = await sb.from("follow_requests").select("requester").eq("requester", currentUser).eq("target", targetUser).maybeSingle();
      if (existingReq) {
        await sb.from("follow_requests").delete().eq("requester", currentUser).eq("target", targetUser);
      } else {
        await sb.from("follow_requests").insert({ requester: currentUser, target: targetUser });
      }
    } else {
      await sb.from("follows").insert({ follower:currentUser, following:targetUser });
    }
  }
  await render();
}

/* ── DELETE own post ── */
async function del(postId) {
  if (!(await uiConfirm("Delete this post?"))) return;
  await sb.from("likes").delete().eq("post_id",postId);
  await sb.from("comments").delete().eq("post_id",postId);
  await sb.from("reports").delete().eq("post_id",postId);
  await sb.from("posts").delete().eq("id",postId).eq("username",currentUser);
  await render();
}

/* ── ADMIN: delete any post ── */
async function adminDelPost(postId) {
  if (!isAdmin()) return;
  if (!(await uiConfirm("Admin: permanently delete this post?"))) return;
  await sb.from("likes").delete().eq("post_id",postId);
  await sb.from("comments").delete().eq("post_id",postId);
  await sb.from("reports").delete().eq("post_id",postId);
  await sb.from("posts").delete().eq("id",postId);
  await render();
}

/* ── ADMIN: ban user ── */
async function adminBanUser(username, skipConfirm=false) {
  if (!isAdmin()) return;
  if (username.toLowerCase()===ADMIN_USER.toLowerCase()) { await uiAlert("Cannot ban admin."); return; }
  if (!skipConfirm && !(await uiConfirm("Admin: ban @"+username+"? This deletes all their content and blocks login."))) return;
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
  if (typeof render === "function") await render();
  await uiAlert("@"+username+" has been banned.");
}

/* ── ADMIN: delete any comment ── */
async function adminDelComment(commentId, postId) {
  if (!isAdmin()) return;
  if (!(await uiConfirm("Admin: delete this comment?"))) return;
  await sb.from("comments").delete().eq("id",commentId);
  await loadComments(postId);
}

/* ── REPORT ── */
async function reportPost(postId, postUsername) {
  if (!currentUser) { await uiAlert("Log in to report posts."); return; }
  const reason = await uiPrompt("Report this post to admin?\nOptionally describe the issue:");
  if (reason === null) return;
  const { data: existing } = await sb.from("reports").select("id").eq("post_id",postId).eq("reporter",currentUser).maybeSingle();
  if (existing) { await uiAlert("You already reported this post."); return; }
  await sb.from("reports").insert({ post_id:postId, reporter:currentUser, reported_user:postUsername, reason:reason||"No reason given" });
  await uiAlert("Report submitted. Thank you.");
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
  if (containsBadWord(t)) { await uiAlert("Your comment contains prohibited language."); return; }
  inp.value = "";
  const { error } = await sb.from("comments").insert({ post_id:postId, username:currentUser, text:t });
  if (error) { await uiAlert("Error: "+error.message); return; }
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
    if (error) { await uiAlert("Error uploading pic: "+error.message); return; }
    delete _picCache[currentUser]; // invalidate so next render fetches fresh pic
    const rp = document.getElementById("rightPic");
    if (rp) rp.src = reader.result;
    await render();
  };
  reader.readAsDataURL(file);
}

/* ── ESCAPE & TEXT RENDERING ── */
function escapeHtml(str) {
  return (str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getUserPageLink(username) {
  const isMobile = window.location.pathname.includes("mobile_");
  const page = isMobile ? "mobile_userpage.html" : "userpage.html";
  return page + "?user=" + encodeURIComponent(username);
}

function getHomeLink() {
  const isMobile = window.location.pathname.includes("mobile_");
  return isMobile ? "mobile_feed.html" : "feed.html";
}

function renderPostText(text) {
  let escaped = escapeHtml(filterText(text));
  // Linkify @username
  escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, (match, p1) => {
    return '<a href="' + getUserPageLink(p1) + '" style="color:var(--accent);text-decoration:none;">@' + p1 + '</a>';
  });
  // Linkify #hashtag
  escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, (match, p1) => {
    const isMobile = window.location.pathname.includes("mobile_");
    const feedPage = isMobile ? "mobile_feed.html" : "feed.html";
    return '<a href="' + feedPage + '?tag=' + p1 + '" class="hashtag" style="color:var(--accent);text-decoration:none;font-weight:bold;">#' + p1 + '</a>';
  });
  return escaped;
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
async function render(searchQuery, sortMode, page) {
  const feedEl = document.getElementById("posts");
  if (!feedEl) return;

  // Allow callers to set the page; default to current global page
  if (typeof page === "number") _currentPage = page;

  // ── 1. Fetch posts for current page only ──
  const from = _currentPage * POST_LIMIT;
  const to   = from + POST_LIMIT - 1;
  let query = sb.from("posts").select("id,username,text,created_at,edited_at,repost_of", { count: "exact" });
  if (searchQuery && searchQuery.trim()) {
    if (searchQuery.startsWith("#")) {
      query = query.ilike("text", "%" + searchQuery.trim() + "%");
    } else {
      query = query.ilike("text", "%"+searchQuery.trim()+"%");
    }
  }
  if (sortMode==="oldest") {
    query = query.order("created_at",{ascending:true});
  } else {
    query = query.order("created_at",{ascending:false});
  }
  query = query.range(from, to);

  const { data: posts, error, count: totalPosts } = await query;
  if (error) { feedEl.innerHTML = "<p>Error loading posts.</p>"; return; }

  const postIds = (posts||[]).map(p=>p.id);

  // ── 2. Scope queries to visible data only ──
  const visibleAuthors = [...new Set((posts||[]).map(p=>p.username))];
  if (!visibleAuthors.includes(currentUser)) visibleAuthors.push(currentUser);

  const [{ data: myLikes },{ data: myFollows },{ data: allLikes },{ data: commentCounts }, { data: blockedUsers }, { data: polls }, { data: pollVotes }, { data: repostedPosts }] = await Promise.all([
    sb.from("likes").select("post_id").eq("username",currentUser),
    sb.from("follows").select("following").eq("follower",currentUser),
    postIds.length ? sb.from("likes").select("post_id").in("post_id",postIds) : Promise.resolve({data:[]}),
    postIds.length ? sb.from("comments").select("post_id").in("post_id",postIds) : Promise.resolve({data:[]}),
    currentUser ? sb.from("blocked_users").select("blocked").eq("blocker", currentUser) : Promise.resolve({data:[]}),
    postIds.length ? sb.from("polls").select("*").in("post_id", postIds) : Promise.resolve({data:[]}),
    postIds.length && currentUser ? sb.from("poll_votes").select("post_id,option_index").in("post_id", postIds).eq("username", currentUser) : Promise.resolve({data:[]}),
    (posts||[]).filter(p=>p.repost_of).length ? sb.from("posts").select("id,username,text").in("id", posts.filter(p=>p.repost_of).map(p=>p.repost_of)) : Promise.resolve({data:[]})
  ]);

  const blockedSet = new Set((blockedUsers||[]).map(b => b.blocked));
  const repostMap = {};
  (repostedPosts||[]).forEach(rp => { repostMap[rp.id] = rp; visibleAuthors.push(rp.username); });

  const pollMap = {};
  (polls||[]).forEach(p => { pollMap[p.post_id] = p.options; });
  const myVoteMap = {};
  (pollVotes||[]).forEach(pv => { myVoteMap[pv.post_id] = pv.option_index; });

  // ── 3. Pic cache: only fetch users whose pic isn't cached yet ──
  const uncached = visibleAuthors.filter(u => !_picCache[u]);
  if (uncached.length) {
    const { data: freshUsers } = await sb.from("users").select("username,pic,bio,verified,is_developer").in("username",uncached);
    (freshUsers||[]).forEach(u => { _picCache[u.username] = u; });
  }
  const userMap = {};
  visibleAuthors.forEach(u => { userMap[u] = _picCache[u] || {}; });

  const commentMap = {};
  (commentCounts||[]).forEach(c=>{ commentMap[c.post_id]=(commentMap[c.post_id]||0)+1; });

  const likedSet = new Set((myLikes||[]).map(l=>l.post_id));
  const followSet = new Set((myFollows||[]).map(f=>f.following));
  const likeMap = {};
  (allLikes||[]).forEach(l=>{ likeMap[l.post_id]=(likeMap[l.post_id]||0)+1; });

  let sortedPosts = posts||[];
  if (sortMode==="popular") {
    sortedPosts = [...sortedPosts].sort((a,b)=>(likeMap[b.id]||0)-(likeMap[a.id]||0));
  }

  const openComments = {};
  feedEl.querySelectorAll(".comment-box").forEach(box=>{
    if (box.style.display!=="none") openComments[box.dataset.postid]=true;
  });

  feedEl.innerHTML = "";

  // Filter out blocked users' posts
  sortedPosts = sortedPosts.filter(p => !blockedSet.has(p.username));

  if (!sortedPosts.length) {
    feedEl.innerHTML = "<div style='text-align:center;padding:24px;color:#888;font-style:italic;'>No posts found.</div>";
    updateTrendingHashtags([]);
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

    const isVerified = uInfo.verified || false;
    const isDeveloper = uInfo.is_developer || false;
    const editedLabel = p.edited_at ? ' <span class="edited-label" style="font-size:10px;color:#999;font-style:italic;" title="Edited at '+new Date(p.edited_at).toLocaleString()+'">(edited)</span>' : '';
    
    let badges = '';
    if (isVerified) badges += ' <span class="badge-icon badge-verified" data-title="Verified User">&nbsp;</span>';
    if (isDeveloper) badges += ' <span class="badge-icon badge-developer" data-title="Developer">&nbsp;</span>';
    
    let repostHtml = '';
    if (p.repost_of && repostMap[p.repost_of]) {
      const rp = repostMap[p.repost_of];
      repostHtml = '<div class="repost-banner" style="font-size:11px;color:#666;margin-bottom:6px;">&#128257; Reposted from <a href="'+getUserPageLink(rp.username)+'" style="color:var(--accent);text-decoration:none;">@'+escapeHtml(rp.username)+'</a></div>'+
                   '<div class="repost-content" style="border-left:3px solid var(--accent);padding-left:10px;margin-bottom:10px;color:#555;">'+renderPostText(rp.text)+'</div>';
    }

    let pollHtml = '';
    if (pollMap[p.id]) {
      const options = pollMap[p.id];
      const myVote = myVoteMap[p.id];
      const totalVotes = options.reduce((sum, opt) => sum + (opt.votes||0), 0);
      pollHtml = '<div class="poll-container" style="margin:10px 0;background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:10px;">';
      options.forEach((opt, idx) => {
        const pct = totalVotes > 0 ? Math.round(((opt.votes||0) / totalVotes) * 100) : 0;
        const isMyVote = myVote === idx;
        pollHtml += '<div class="poll-option" style="margin-bottom:6px;position:relative;cursor:pointer;" onclick="votePoll('+p.id+', '+idx+')">'+
                      '<div class="poll-bar" style="position:absolute;left:0;top:0;bottom:0;background:'+(isMyVote?'#d0e0ff':'#e0e0e0')+';width:'+pct+'%;border-radius:2px;z-index:1;"></div>'+
                      '<div style="position:relative;z-index:2;display:flex;justify-content:space-between;padding:4px 8px;font-size:13px;font-weight:'+(isMyVote?'bold':'normal')+';">'+
                        '<span>'+escapeHtml(opt.text)+' '+(isMyVote?'✓':'')+'</span><span>'+pct+'%</span>'+
                      '</div>'+
                    '</div>';
      });
      pollHtml += '<div style="font-size:11px;color:#888;text-align:right;">'+totalVotes+' vote'+(totalVotes!==1?'s':'')+'</div></div>';
    }

    const editTimeWindow = 15 * 60 * 1000; // 15 mins
    const canEdit = isOwn && (Date.now() - new Date(p.created_at).getTime() < editTimeWindow);

    const div = document.createElement("div");
    div.className = "post";
    div.id = "post-"+p.id;
    div.innerHTML =
      '<div class="post-header">'+
        '<a href="'+getUserPageLink(p.username)+'" class="post-avatar-link">'+
          '<img class="post-avatar" src="'+escapeHtml(pic)+'" onerror="this.src=\'empty.jpg\'">'+
        '</a>'+
        '<div class="post-meta">'+
          '<a href="'+getUserPageLink(p.username)+'" class="user-link">@'+escapeHtml(p.username)+'</a>'+
          badges +
          (p.username!==currentUser
            ? ' <button class="follow-btn '+(isFollowing?"following":"")+'" onclick="follow(\''+p.username+'\')\">'+(isFollowing?"✓ Following":"+ Follow")+'</button>'
            : ' <span class="you-tag">you</span>')+
          '<div class="post-time">'+timeAgo(p.created_at)+editedLabel+'</div>'+
        '</div>'+
        (isOwn ? '<span class="delete" onclick="del('+p.id+')">✕</span>' : '')+
      '</div>'+
      repostHtml +
      '<div class="post-text" id="post-text-'+p.id+'">'+renderPostText(p.text)+'</div>'+
      pollHtml +
      '<div class="post-actions">'+
        '<span id="likes-'+p.id+'" class="like-wrap"><span class="heart'+(liked?" liked":"")+'" onclick="like('+p.id+')">&#9829;</span> '+likeCount+' likes</span>'+
        '<span class="comment-toggle" onclick="toggleComments('+p.id+')">&#128172; '+commentCount+' comments</span>'+
        (currentUser ? ' <span class="repost-btn" onclick="repost('+p.id+',\''+p.username.replace(/'/g,"\\'")+'\')" style="cursor:pointer;color:#555;">&#128257; Share</span>' : '')+
        (canEdit ? ' <span class="edit-btn" onclick="editPostPrompt('+p.id+',\''+escapeHtml(p.text.replace(/'/g,"\\'"))+'\')" style="cursor:pointer;color:#555;margin-left:auto;">&#9998; Edit</span>' : '')+
        (!isOwn ? '<span class="report-btn" onclick="reportPost('+p.id+',\''+p.username.replace(/'/g,"\\'")+'\')" title="Report this post" style="margin-left:auto;">⚑ Report</span>' : '')+
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

  // ── 4. Pagination controls ──
  const totalPages = Math.ceil((totalPosts || 0) / POST_LIMIT);
  const paginationEl = document.getElementById("pagination");
  if (paginationEl) {
    if (totalPages <= 1) {
      paginationEl.innerHTML = "";
    } else {
      const hasPrev = _currentPage > 0;
      const hasNext = _currentPage < totalPages - 1;
      paginationEl.innerHTML =
        '<div class="page-controls">'+
          (hasPrev ? '<button class="page-btn" onclick="goPage('+ (_currentPage-1) +',this)">← Prev</button>' : '<button class="page-btn" disabled>← Prev</button>')+
          '<span class="page-info">Page '+(_currentPage+1)+' of '+totalPages+'</span>'+
          (hasNext ? '<button class="page-btn" onclick="goPage('+ (_currentPage+1) +',this)">Next →</button>' : '<button class="page-btn" disabled>Next →</button>')+
        '</div>';
    }
  }

  // ── 5. Sidebar: use cached user data, only fetch follow counts ──
  const me = userMap[currentUser]||{};
  const [{ count: myFollowers },{ count: myFollowing }] = await Promise.all([
    sb.from("follows").select("*",{count:"exact",head:true}).eq("following",currentUser),
    sb.from("follows").select("*",{count:"exact",head:true}).eq("follower",currentUser),
  ]);

  const rp=document.getElementById("rightPic"), rn=document.getElementById("rightName");
  const rf=document.getElementById("rightFollowers"), rb=document.getElementById("rightBio");
  if (rp) rp.src = me.pic||"empty.jpg";
  if (rn) rn.innerHTML = '<a href="'+getUserPageLink(currentUser)+'" style="color:var(--accent);text-decoration:none;">@'+currentUser+'</a>'+(isAdmin()?' <span class="admin-badge">ADMIN</span>':'');
  if (rf) rf.innerHTML = '<span>'+(myFollowers||0)+' followers</span> · <span>'+(myFollowing||0)+' following</span>';
  if (rb) rb.innerText = me.bio||"";
}

/* ── USER SEARCH ── */
async function renderUserSearch(query) {
  const feedEl = document.getElementById("posts");
  const paginationEl = document.getElementById("pagination");
  if (!feedEl) return;
  if (paginationEl) paginationEl.innerHTML = "";

  if (!query || !query.trim()) {
    feedEl.innerHTML = "<div style='text-align:center;padding:24px;color:#888;font-style:italic;'>Type a username to search.</div>";
    return;
  }

  feedEl.innerHTML = "<div style='text-align:center;padding:20px;color:#888;font-style:italic;'>Searching users...</div>";

  const { data: users } = await sb.from("users")
    .select("username,pic,bio,verified,is_developer")
    .ilike("username", "%" + query.trim() + "%")
    .limit(30);

  if (!users || !users.length) {
    feedEl.innerHTML = "<div style='text-align:center;padding:24px;color:#888;font-style:italic;'>No users found.</div>";
    return;
  }

  const usernames = users.map(u => u.username);
  const [{ data: myFollows }, { data: allFollowers }] = await Promise.all([
    currentUser ? sb.from("follows").select("following").eq("follower", currentUser).in("following", usernames) : Promise.resolve({data:[]}),
    sb.from("follows").select("following").in("following", usernames),
  ]);

  const followSet = new Set((myFollows||[]).map(f => f.following));
  const followerMap = {};
  (allFollowers||[]).forEach(f => { followerMap[f.following] = (followerMap[f.following]||0)+1; });

  feedEl.innerHTML = "";
  for (const u of users) {
    const isMe = u.username === currentUser;
    const isFollowing = followSet.has(u.username);
    const fc = followerMap[u.username] || 0;
    const isVerified = u.verified || false;
    const isDeveloper = u.is_developer || false;
    let badges = '';
    if (isVerified) badges += ' <span class="badge-icon badge-verified" data-title="Verified User">&nbsp;</span>';
    if (isDeveloper) badges += ' <span class="badge-icon badge-developer" data-title="Developer">&nbsp;</span>';
    
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML =
      '<div class="post-header">'+
        '<a href="'+getUserPageLink(u.username)+'" class="post-avatar-link">'+
          '<img class="post-avatar" src="'+escapeHtml(u.pic||'')+'" onerror="this.src=\'empty.jpg\'">'+
        '</a>'+
        '<div class="post-meta">'+
          '<a href="'+getUserPageLink(u.username)+'" class="user-link">@'+escapeHtml(u.username)+'</a>'+
          badges +
          (!isMe
            ? ' <button class="follow-btn '+(isFollowing?'following':'')+'" onclick="searchFollow(\''+u.username+'\')">'+(isFollowing?'\u2713 Following':'+ Follow')+'</button>'
            : ' <span class="you-tag">you</span>')+
          '<div class="post-time">'+fc+' follower'+(fc!==1?'s':'')+'</div>'+
          (u.bio ? '<div style="font-size:12px;color:#666;font-style:italic;margin-top:3px;">'+escapeHtml(u.bio)+'</div>' : '')+
        '</div>'+
      '</div>';
    feedEl.appendChild(div);
  }
}

async function searchFollow(targetUser) {
  if (!currentUser || targetUser === currentUser) return;
  // Check if target is private
  const { data: targetData } = await sb.from("users").select("is_private").eq("username", targetUser).maybeSingle();
  if (targetData && targetData.is_private) {
    const { data: existingFollow } = await sb.from("follows").select("follower").eq("follower", currentUser).eq("following", targetUser).maybeSingle();
    if (existingFollow) {
      await sb.from("follows").delete().eq("follower", currentUser).eq("following", targetUser);
    } else {
      const { data: existingReq } = await sb.from("follow_requests").select("requester").eq("requester", currentUser).eq("target", targetUser).maybeSingle();
      if (existingReq) await sb.from("follow_requests").delete().eq("requester", currentUser).eq("target", targetUser);
      else await sb.from("follow_requests").insert({ requester: currentUser, target: targetUser });
      await uiAlert("Follow request sent to @" + targetUser);
    }
  } else {
    const { data: existing } = await sb.from("follows").select("follower").eq("follower",currentUser).eq("following",targetUser).maybeSingle();
    if (existing) { await sb.from("follows").delete().eq("follower",currentUser).eq("following",targetUser); }
    else { await sb.from("follows").insert({ follower:currentUser, following:targetUser }); }
  }
  const inp = document.getElementById("searchInput");
  if (inp) renderUserSearch(inp.value.trim());
}

/* ── HASHTAGS ── */
function updateTrendingHashtags(posts) {
  const trendingCard = document.getElementById("trendingCard");
  if (!trendingCard) return;
  const counts = {};
  posts.forEach(p => {
    const matches = p.text.match(/#([a-zA-Z0-9_]+)/g);
    if (matches) {
      matches.forEach(m => {
        const tag = m.substring(1).toLowerCase();
        counts[tag] = (counts[tag]||0) + 1;
      });
    }
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
  if (!sorted.length) {
    trendingCard.style.display = "none";
    return;
  }
  trendingCard.style.display = "block";
  const list = trendingCard.querySelector(".card-body");
  list.innerHTML = sorted.map(([tag, count]) => 
    '<div style="margin-bottom:6px;"><a href="feed.html?tag='+tag+'" style="color:var(--accent);text-decoration:none;font-weight:bold;">#'+escapeHtml(tag)+'</a> <span style="font-size:11px;color:#888;">'+count+' posts</span></div>'
  ).join('');
}

/* ── REPOST ── */
async function repost(postId, originalAuthor) {
  if (!currentUser) { await uiAlert("Log in to repost."); return; }
  if (originalAuthor === currentUser) { await uiAlert("You cannot repost your own post."); return; }
  const t = await uiPrompt("Repost @" + originalAuthor + "'s post?\nAdd your own comment (optional):");
  if (t === null) return;
  if (containsBadWord(t)) { await uiAlert("Your post contains prohibited language."); return; }
  const { error } = await sb.from("posts").insert({ username: currentUser, text: t.trim()||" ", repost_of: postId });
  if (error) { await uiAlert("Error reposting: " + error.message); return; }
  await render();
}

/* ── EDIT POST ── */
function editPostPrompt(postId, currentText) {
  const pt = document.getElementById("post-text-"+postId);
  if (!pt) return;
  pt.innerHTML = '<textarea id="edit-input-'+postId+'" style="width:100%;height:60px;padding:6px;border:1px solid var(--border);border-radius:4px;font-family:inherit;resize:vertical;"></textarea>'+
                 '<div style="margin-top:6px;text-align:right;">'+
                   '<button onclick="render()" style="padding:4px 10px;background:#ddd;border:1px solid #ccc;cursor:pointer;margin-right:6px;">Cancel</button>'+
                   '<button onclick="saveEditPost('+postId+')" style="padding:4px 10px;background:var(--accent);color:white;border:1px solid var(--accent);cursor:pointer;">Save Edit</button>'+
                 '</div>';
  const textarea = document.getElementById("edit-input-"+postId);
  // Decode HTML entities safely using a dummy element
  const doc = new DOMParser().parseFromString(currentText, "text/html");
  textarea.value = doc.documentElement.textContent;
  textarea.focus();
}

async function saveEditPost(postId) {
  const textarea = document.getElementById("edit-input-"+postId);
  if (!textarea) return;
  const newText = textarea.value.trim();
  if (!newText) { await uiAlert("Post cannot be empty."); return; }
  if (containsBadWord(newText)) { await uiAlert("Your post contains prohibited language."); return; }
  
  const { error } = await sb.from("posts").update({ text: newText, edited_at: new Date().toISOString() }).eq("id", postId).eq("username", currentUser);
  if (error) { await uiAlert("Error editing post: " + error.message); return; }
  await render();
}

/* ── POLLS ── */
async function votePoll(postId, optionIndex) {
  if (!currentUser) { await uiAlert("Log in to vote."); return; }
  const { data: existingVote } = await sb.from("poll_votes").select("*").eq("post_id", postId).eq("username", currentUser).maybeSingle();
  if (existingVote) {
    if (existingVote.option_index === optionIndex) return; // already voted for this option
    // Update existing vote
    await sb.from("poll_votes").update({ option_index: optionIndex }).eq("post_id", postId).eq("username", currentUser);
    // Update poll options count
    const { data: poll } = await sb.from("polls").select("options").eq("post_id", postId).single();
    if (poll) {
      poll.options[existingVote.option_index].votes = Math.max(0, (poll.options[existingVote.option_index].votes||0) - 1);
      poll.options[optionIndex].votes = (poll.options[optionIndex].votes||0) + 1;
      await sb.from("polls").update({ options: poll.options }).eq("post_id", postId);
    }
  } else {
    // Insert new vote
    await sb.from("poll_votes").insert({ post_id: postId, username: currentUser, option_index: optionIndex });
    // Update poll options count
    const { data: poll } = await sb.from("polls").select("options").eq("post_id", postId).single();
    if (poll) {
      poll.options[optionIndex].votes = (poll.options[optionIndex].votes||0) + 1;
      await sb.from("polls").update({ options: poll.options }).eq("post_id", postId);
    }
  }
  if (typeof render === "function") await render();
  if (typeof load === "function") await load();
}

/* ── BLOCK USER ── */
async function blockUserFromFeed(targetUser) {
  if (!currentUser) return;
  if (!(await uiConfirm("Block @"+targetUser+"? You won't see their posts and they will be removed from your followers/following."))) return;
  
  await sb.from("blocked_users").upsert({ blocker: currentUser, blocked: targetUser });
  // Remove mutual follows
  await sb.from("follows").delete().eq("follower", currentUser).eq("following", targetUser);
  await sb.from("follows").delete().eq("follower", targetUser).eq("following", currentUser);
  await uiAlert("@"+targetUser+" is now blocked.");
  
  if (location.href.includes("userpage.html")) {
    location.reload();
  } else {
    await render();
  }
}

async function unblockUser(targetUser) {
  if (!currentUser) return;
  await sb.from("blocked_users").delete().eq("blocker", currentUser).eq("blocked", targetUser);
  await uiAlert("@"+targetUser+" has been unblocked.");
  location.reload();
}

/* ── UI HELPERS ── */
function togglePollInputs() {
  const el = document.getElementById("pollInputs");
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
}
