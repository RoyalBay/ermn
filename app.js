// Keys resolved by config.js
const SUPABASE_URL = window.ERMN_URL;
const SUPABASE_KEY = window.ERMN_KEY;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let _isAdmin = false;
let _isDeveloper = false;
let _picCache = {};
let _currentPage = 0;

window.logout = async function() {
  if (typeof sb !== 'undefined') await sb.auth.signOut();
  localStorage.removeItem("currentUser");
  localStorage.removeItem("isDeveloper");
  localStorage.setItem("theme", "classic");
  const isMobile = window.location.pathname.includes("mobile");
  location.href = isMobile ? "mobile.html" : "index.html";
};

// Handle Auth State
async function initSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const { data: profile } = await sb.from("users").select("username, is_admin, is_developer").eq("id", session.user.id).maybeSingle();
    if (profile) {
      currentUser = profile.username;
      _isAdmin = profile.is_admin;
      localStorage.setItem("currentUser", currentUser);
      localStorage.setItem("isDeveloper", profile.is_developer || false);
    } else {
      currentUser = session.user.user_metadata.username;
      localStorage.setItem("currentUser", currentUser);
    }
    // Check if user ID or username is banned
    const userId = session.user.id;
    const { data: idBanned } = await sb.from("banned_users").select("username").eq("username", "id:"+userId).maybeSingle();
    const { data: userBanned } = (currentUser && typeof currentUser === "string") 
      ? await sb.from("banned_users").select("username").eq("username", currentUser.toLowerCase()).maybeSingle()
      : { data: null };

    if (idBanned || userBanned) {
      await sb.auth.signOut();
      localStorage.removeItem("currentUser");
      localStorage.removeItem("isDeveloper");
      location.href = "banned.html";
      return;
    }
  } else {
    currentUser = localStorage.getItem("currentUser");
  }
  document.dispatchEvent(new Event("sessionReady"));
}
initSession();

/* ── EGRESS OPTIMISATION ── */
const POST_LIMIT = 20; // posts per page
/* Globals moved to top */

/* ── PROFILE MUSIC PLAYER ── */
window.ProfileMusicPlayer = {
  audio: null,
  currentTrackId: null,
  isPlaying: false,
  onStateChange: null,

  play: function(trackData) {
    if (this.audio && this.currentTrackId === trackData.trackId) {
      this.audio.play();
      this.isPlaying = true;
      if (this.onStateChange) this.onStateChange(true);
      return;
    }

    if (this.audio) {
      this.audio.pause();
    }

    this.audio = new Audio(trackData.previewUrl);
    this.currentTrackId = trackData.trackId;
    this.isPlaying = true;
    
    this.audio.addEventListener('loadedmetadata', () => {
      if (trackData.startTime) {
        this.audio.currentTime = parseFloat(trackData.startTime);
      }
      this.audio.play().catch(e => console.error("Audio play failed:", e));
    });
    
    this.audio.onended = () => {
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange(false);
    };

    if (this.onStateChange) this.onStateChange(true);
  },

  pause: function() {
    if (this.audio) {
      this.audio.pause();
      this.isPlaying = false;
      if (this.onStateChange) this.onStateChange(false);
    }
  },

  toggle: function(trackData) {
    if (this.isPlaying && this.currentTrackId === trackData.trackId) {
      this.pause();
    } else {
      this.play(trackData);
    }
  }
};

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
    filter: var(--badge-glow);
  }
  .sidebar-links a, .topbar-nav a.active, .bottom-nav a.active, .user-link, .stat-item strong, .modal-user a {
    text-shadow: var(--neon-glow);
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
/* Globals moved to top */
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
// Handled by theme.js

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
    el.innerHTML = '<span class="heart'+(mine?" liked":"")+'" onclick="like('+postId+')"><span class="material-icons" style="font-size:14px;vertical-align:middle;">favorite</span></span> '+(count||0)+' likes';
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
  const secret = sessionStorage.getItem("adminSecret");
  const { error } = await sb.rpc('admin_delete_post_secure', { target_post_id: postId, provided_secret: secret });
  if (error) { await uiAlert("Admin Error: " + error.message); return; }
  await render();
}

/* ── ADMIN: ban user ── */
async function adminBanUser(username, skipConfirm=false) {
  if (!isAdmin()) return;
  if (username.toLowerCase()===ADMIN_USER.toLowerCase()) { await uiAlert("Cannot ban admin."); return; }
  
  if (!skipConfirm && !(await uiConfirm("Admin: ban @"+username+"? This deletes all their content and blocks their account."))) return;
  
  const secret = sessionStorage.getItem("adminSecret");
  const { error } = await sb.rpc('admin_ban_user_secure', { target_username: username, provided_secret: secret });
  
  if (error) {
    await uiAlert("Admin Error: " + error.message);
    return;
  }

  if (typeof render === "function") await render();
  await uiAlert("@"+username+" has been banned. Their content has been restricted.");
}

/* ── ADMIN: delete any comment ── */
async function adminDelComment(commentId, postId) {
  if (!isAdmin()) return;
  if (!(await uiConfirm("Admin: delete this comment?"))) return;
  const secret = sessionStorage.getItem("adminSecret");
  const { error } = await sb.rpc('admin_delete_comment_secure', { target_comment_id: commentId, provided_secret: secret });
  if (error) { await uiAlert("Admin Error: " + error.message); return; }
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
    const canDelAdmin = isAdmin() && !canDelOwn && localStorage.getItem("hideAdminControls") !== "true";
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

  const isLite = localStorage.getItem("dev_layout") === "lite";
  const limit = isLite ? 10 : POST_LIMIT;

  // ── 1. Fetch posts for current page only ──
  const from = _currentPage * limit;
  const to   = from + limit - 1;
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
  if (currentUser && !visibleAuthors.includes(currentUser)) visibleAuthors.push(currentUser);

  const [{ data: myLikes },{ data: myFollows },{ data: allLikes },{ data: commentCounts }, { data: blockedUsers }, { data: polls }, { data: pollVotes }, { data: repostedPosts }] = await Promise.all([
    currentUser ? sb.from("likes").select("post_id").eq("username",currentUser) : Promise.resolve({data:[]}),
    currentUser ? sb.from("follows").select("following").eq("follower",currentUser) : Promise.resolve({data:[]}),
    (postIds.length && !isLite) ? sb.from("likes").select("post_id").in("post_id",postIds) : Promise.resolve({data:[]}),
    (postIds.length && !isLite) ? sb.from("comments").select("post_id").in("post_id",postIds) : Promise.resolve({data:[]}),
    currentUser ? sb.from("blocked_users").select("blocked").eq("blocker", currentUser) : Promise.resolve({data:[]}),
    (postIds.length && !isLite) ? sb.from("polls").select("*").in("post_id", postIds) : Promise.resolve({data:[]}),
    (postIds.length && currentUser && !isLite) ? sb.from("poll_votes").select("post_id,option_index").in("post_id", postIds).eq("username", currentUser) : Promise.resolve({data:[]}),
    ((posts||[]).filter(p=>p.repost_of).length && !isLite) ? sb.from("posts").select("id,username,text").in("id", posts.filter(p=>p.repost_of).map(p=>p.repost_of)) : Promise.resolve({data:[]})
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
  if (uncached.length && !isLite) {
    const { data: freshUsers } = await sb.from("users").select("username,pic,bio,verified,is_developer").in("username",uncached);
    (freshUsers||[]).forEach(u => { _picCache[u.username] = u; });
  } else if (isLite && uncached.length) {
    uncached.forEach(u => { _picCache[u] = { username: u, pic: "empty.jpg", verified: false, is_developer: false, bio: "" }; });
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
    const pic = uInfo.pic||"empty.jpg";
    const isOpen = openComments[p.id];
    const isOwn = p.username===currentUser;
    const admin = isAdmin() && localStorage.getItem("hideAdminControls") !== "true";

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
      repostHtml = '<div class="repost-banner" style="font-size:11px;color:#666;margin-bottom:6px;"><span class="material-icons" style="font-size:12px;vertical-align:middle;margin-right:2px;">sync</span> Reposted from <a href="'+getUserPageLink(rp.username)+'" style="color:var(--accent);text-decoration:none;">@'+escapeHtml(rp.username)+'</a></div>'+
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
                        '<span>'+escapeHtml(opt.text)+' '+(isMyVote?'<span class="material-icons" style="font-size:14px;vertical-align:middle;">check</span>':'')+'</span><span>'+pct+'%</span>'+
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
            ? ' <button class="follow-btn '+(isFollowing?"following":"")+'" onclick="follow(\''+p.username+'\')\">'+(isFollowing?'<span class="material-icons" style="font-size:14px;vertical-align:middle;">check</span> Following':'+ Follow')+'</button>'
            : ' <span class="you-tag">you</span>')+
          '<div class="post-time">'+timeAgo(p.created_at)+editedLabel+'</div>'+
        '</div>'+
        (isOwn ? '<span class="delete" onclick="del('+p.id+')"><span class="material-icons" style="font-size:16px;">close</span></span>' : '')+
      '</div>'+
      repostHtml +
      '<div class="post-text" id="post-text-'+p.id+'">'+renderPostText(p.text)+'</div>'+
      pollHtml +
      '<div class="post-actions">'+
        '<span id="likes-'+p.id+'" class="like-wrap"><span class="heart'+(liked?" liked":"")+'" onclick="like('+p.id+')"><span class="material-icons" style="font-size:18px;">favorite</span></span> '+likeCount+' likes</span>'+
        '<span class="comment-toggle" onclick="toggleComments('+p.id+')"><span class="material-icons" style="font-size:18px;">mode_comment</span> '+commentCount+' comments</span>'+
        (currentUser ? ' <span class="repost-btn" onclick="repost('+p.id+',\''+p.username.replace(/'/g,"\\'")+'\')" style="cursor:pointer;color:#555;"><span class="material-icons" style="font-size:18px;">sync</span> Share</span>' : '')+
        (canEdit ? ' <span class="edit-btn" onclick="editPostPrompt('+p.id+',\''+escapeHtml(p.text.replace(/'/g,"\\'"))+'\')" style="cursor:pointer;color:#555;margin-left:auto;"><span class="material-icons" style="font-size:18px;">edit</span> Edit</span>' : '')+
        (!isOwn ? '<span class="report-btn" onclick="reportPost('+p.id+',\''+p.username.replace(/'/g,"\\'")+'\')" title="Report this post" style="margin-left:auto;"><span class="material-icons" style="font-size:16px;">flag</span> Report</span>' : '')+
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
  const totalPages = Math.ceil((totalPosts || 0) / limit);
  const paginationEl = document.getElementById("pagination");
  if (paginationEl) {
    if (totalPages <= 1) {
      paginationEl.innerHTML = "";
    } else {
      const hasPrev = _currentPage > 0;
      const hasNext = _currentPage < totalPages - 1;
      paginationEl.innerHTML =
        '<div class="page-controls">'+
          (hasPrev ? '<button class="page-btn" onclick="goPage('+ (_currentPage-1) +',this)"><span class="material-icons" style="font-size:16px;vertical-align:middle;">chevron_left</span> Prev</button>' : '<button class="page-btn" disabled><span class="material-icons" style="font-size:16px;vertical-align:middle;">chevron_left</span> Prev</button>')+
          '<span class="page-info">Page '+(_currentPage+1)+' of '+totalPages+'</span>'+
          (hasNext ? '<button class="page-btn" onclick="goPage('+ (_currentPage+1) +',this)">Next <span class="material-icons" style="font-size:16px;vertical-align:middle;">chevron_right</span></button>' : '<button class="page-btn" disabled>Next <span class="material-icons" style="font-size:16px;vertical-align:middle;">chevron_right</span></button>')+
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
  if (rn) {
    let badges = "";
    if (me.verified) badges += ' <span class="badge-icon badge-verified" data-title="Verified User">&nbsp;</span>';
    if (me.is_developer) badges += ' <span class="badge-icon badge-developer" data-title="Developer">&nbsp;</span>';
    rn.innerHTML = '<a href="'+getUserPageLink(currentUser)+'" style="color:var(--accent);text-decoration:none;">@'+currentUser+'</a>'+badges+((isAdmin() && localStorage.getItem("hideAdminControls") !== "true")?' <span class="admin-badge">ADMIN</span>':'');
  }
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
          '<img class="post-avatar" src="'+escapeHtml(u.pic||"empty.jpg")+'" onerror="this.src=\'empty.jpg\'">'+
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

/* ── ALGO FEED ── */
async function renderAlgo() {
  const feedEl = document.getElementById("posts");
  if (!feedEl) return;
  feedEl.innerHTML = "<div style=\"text-align:center;padding:40px;color:#888;font-style:italic;\">Curating your discovery feed...</div>";

  const isLite = localStorage.getItem("dev_layout") === "lite";

  // 1. Fetch recent candidates (minimize egress by fetching only what's needed for scoring)
  const { data: candidates, error } = await sb.from("posts").select("id,username,text,created_at,edited_at,repost_of").order("created_at", { ascending: false }).limit(isLite ? 30 : 100);
  if (error) { feedEl.innerHTML = "<p>Error loading feed.</p>"; return; }

  const candIds = candidates.map(p => p.id);
  const candAuthors = [...new Set(candidates.map(p => p.username))];

  // 2. Parallel fetch for scoring data (Minimize egress: just counts or IDs)
  const [{ data: allLikes }, { data: allFollowers }] = await Promise.all([
    !isLite ? sb.from("likes").select("post_id").in("post_id", candIds) : Promise.resolve({data:[]}),
    !isLite ? sb.from("follows").select("following").in("following", candAuthors) : Promise.resolve({data:[]})
  ]);

  // 3. Scoring Logic
  const likeCounts = {}; (allLikes||[]).forEach(l => { likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1; });
  const followCounts = {}; (allFollowers||[]).forEach(f => { followCounts[f.following] = (followCounts[f.following] || 0) + 1; });
  
  // Trending Tags
  const tagCounts = {};
  candidates.forEach(p => {
    const tags = p.text.match(/#([a-zA-Z0-9_]+)/g);
    if (tags) tags.forEach(t => { const tag = t.toLowerCase(); tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
  });
  const topTags = Object.entries(tagCounts).sort((a,b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

  const scoredPosts = candidates.map(p => {
    const likes = likeCounts[p.id] || 0;
    const followers = followCounts[p.username] || 0;
    const hasTrend = topTags.some(tag => p.text.toLowerCase().includes(tag));
    
    // Score Formula: Weighted likes, followers, and trends
    let score = (likes * 10) + (followers * 2) + (hasTrend ? 30 : 0);
    return { ...p, score, likes };
  });

  // 4. Selection
  scoredPosts.sort((a,b) => b.score - a.score);
  
  const highQuality = scoredPosts.slice(0, 30);
  const others = scoredPosts.slice(30);

  const selectedPosts = [];
  // Take top 15 high quality
  selectedPosts.push(...highQuality.slice(0, 15));
  
  // Rarely add in posts with little likes to boost them (Boost Logic)
  // We'll take 3 from the "others" pool randomly
  if (others.length > 0) {
    const boostCandidates = others.sort(() => 0.5 - Math.random()).slice(0, 3);
    selectedPosts.push(...boostCandidates);
  }

  // Final shuffle for variety
  selectedPosts.sort(() => 0.5 - Math.random());
  
  const finalPosts = selectedPosts;


  // 5. Render using a simplified version of the existing render logic
  // (We need to reuse some of the setup from the main render function)
  const postIds = finalPosts.map(p => p.id);
  const visibleAuthors = [...new Set(finalPosts.map(p => p.username))];
  if (currentUser && !visibleAuthors.includes(currentUser)) visibleAuthors.push(currentUser);

  const [{ data: myLikes },{ data: myFollows },{ data: postLikes },{ data: commentCounts }, { data: blockedUsers }, { data: polls }, { data: pollVotes }, { data: repostedPosts }] = await Promise.all([
    currentUser ? sb.from("likes").select("post_id").eq("username",currentUser) : Promise.resolve({data:[]}),
    currentUser ? sb.from("follows").select("following").eq("follower",currentUser) : Promise.resolve({data:[]}),
    (postIds.length && !isLite) ? sb.from("likes").select("post_id").in("post_id",postIds) : Promise.resolve({data:[]}),
    (postIds.length && !isLite) ? sb.from("comments").select("post_id").in("post_id",postIds) : Promise.resolve({data:[]}),
    currentUser ? sb.from("blocked_users").select("blocked").eq("blocker", currentUser) : Promise.resolve({data:[]}),
    (postIds.length && !isLite) ? sb.from("polls").select("*").in("post_id", postIds) : Promise.resolve({data:[]}),
    (postIds.length && currentUser && !isLite) ? sb.from("poll_votes").select("post_id,option_index").in("post_id", postIds).eq("username", currentUser) : Promise.resolve({data:[]}),
    (finalPosts.filter(p=>p.repost_of).length && !isLite) ? sb.from("posts").select("id,username,text").in("id", finalPosts.filter(p=>p.repost_of).map(p=>p.repost_of)) : Promise.resolve({data:[]})
  ]);

  const blockedSet = new Set((blockedUsers||[]).map(b => b.blocked));
  const filteredPosts = finalPosts.filter(p => !blockedSet.has(p.username));

  // Re-use logic from render() but for filteredPosts... 
  // Since render() is quite large, I will call a modified version or just re-implement the UI loop.
  // To keep it simple and consistent, I will define a helper renderPostsList(posts, ...) in app.js
  // But for now, I will just manually build the HTML to match exactly.
  
  // Actually, let's refactor app.js to have a generic renderPosts(posts, containerId) 
  // But to minimize changes, I will just copy the core loop here.
  
  // [Pre-processing as in render()]
  const repostMap = {}; (repostedPosts||[]).forEach(rp => { repostMap[rp.id] = rp; visibleAuthors.push(rp.username); });
  const pollMap = {}; (polls||[]).forEach(p => { pollMap[p.post_id] = p.options; });
  const myVoteMap = {}; (pollVotes||[]).forEach(pv => { myVoteMap[pv.post_id] = pv.option_index; });
  
  const uncached = visibleAuthors.filter(u => !_picCache[u]);
  if (uncached.length && !isLite) {
    const { data: freshUsers } = await sb.from("users").select("username,pic,bio,verified,is_developer").in("username",uncached);
    (freshUsers||[]).forEach(u => { _picCache[u.username] = u; });
  } else if (isLite && uncached.length) {
    uncached.forEach(u => { _picCache[u] = { username: u, pic: "empty.jpg", verified: false, is_developer: false, bio: "" }; });
  }
  const userMap = {}; visibleAuthors.forEach(u => { userMap[u] = _picCache[u] || {}; });
  const commentMap = {}; (commentCounts||[]).forEach(c=>{ commentMap[c.post_id]=(commentMap[c.post_id]||0)+1; });
  const likedSet = new Set((myLikes||[]).map(l=>l.post_id));
  const followSet = new Set((myFollows||[]).map(f=>f.following));
  const likeMap = {}; (postLikes||[]).forEach(l=>{ likeMap[l.post_id]=(likeMap[l.post_id]||0)+1; });

  feedEl.innerHTML = "";
  if (!filteredPosts.length) {
    feedEl.innerHTML = "<div style=\"text-align:center;padding:24px;color:#888;font-style:italic;\">Nothing to show here yet.</div>";
    return;
  }

  for (const p of filteredPosts) {
    // [The exact same HTML generation from render()]
    const liked = likedSet.has(p.id);
    const likeCount = likeMap[p.id]||0;
    const commentCount = commentMap[p.id]||0;
    const isFollowing = followSet.has(p.username);
    const uInfo = userMap[p.username]||{};
    const pic = uInfo.pic||"empty.jpg";
    const isOwn = p.username===currentUser;
    const admin = isAdmin() && localStorage.getItem("hideAdminControls") !== "true";
    const adminBar = admin ? '\'' + '\'' : ""; // Simplified for now to avoid complexity in this turn

    const isVerified = uInfo.verified || false;
    const isDeveloper = uInfo.is_developer || false;
    const editedLabel = p.edited_at ? " <span class=\"edited-label\" style=\"font-size:10px;color:#999;font-style:italic;\">(edited)</span>" : "";
    
    let badges = "";
    if (isVerified) badges += " <span class=\"badge-icon badge-verified\" data-title=\"Verified User\">&nbsp;</span>";
    if (isDeveloper) badges += " <span class=\"badge-icon badge-developer\" data-title=\"Developer\">&nbsp;</span>";
    
    let repostHtml = "";
    if (p.repost_of && repostMap[p.repost_of]) {
      const rp = repostMap[p.repost_of];
      repostHtml = "<div class=\"repost-banner\" style=\"font-size:11px;color:#666;margin-bottom:6px;\"><span class=\"material-icons\" style=\"font-size:12px;vertical-align:middle;margin-right:2px;\">sync</span> Reposted from <a href=\""+getUserPageLink(rp.username)+"\" style=\"color:var(--accent);text-decoration:none;\">@"+escapeHtml(rp.username)+"</a></div>"+
                   "<div class=\"repost-content\" style=\"border-left:3px solid var(--accent);padding-left:10px;margin-bottom:10px;color:#555;\">"+renderPostText(rp.text)+"</div>";
    }

    let pollHtml = "";
    if (pollMap[p.id]) {
      const options = pollMap[p.id];
      const myVote = myVoteMap[p.id];
      const totalVotes = options.reduce((sum, opt) => sum + (opt.votes||0), 0);
      pollHtml = "<div class=\"poll-container\" style=\"margin:10px 0;background:#f9f9f9;border:1px solid #eee;border-radius:4px;padding:10px;\">";
      options.forEach((opt, idx) => {
        const pct = totalVotes > 0 ? Math.round(((opt.votes||0) / totalVotes) * 100) : 0;
        const isMyVote = myVote === idx;
        pollHtml += "<div class=\"poll-option\" style=\"margin-bottom:6px;position:relative;cursor:pointer;\" onclick=\"votePoll("+p.id+", "+idx+")\">"+
                      "<div class=\"poll-bar\" style=\"position:absolute;left:0;top:0;bottom:0;background:"+(isMyVote?"#d0e0ff":"#e0e0e0")+";width:"+pct+"%;border-radius:2px;z-index:1;\"></div>"+
                      "<div style=\"position:relative;z-index:2;display:flex;justify-content:space-between;padding:4px 8px;font-size:13px;font-weight:"+(isMyVote?"bold":"normal")+";\">"+
                        "<span>"+escapeHtml(opt.text)+" "+(isMyVote?"<span class=\"material-icons\" style=\"font-size:14px;vertical-align:middle;\">check</span>":"")+"</span><span>"+pct+"%</span>"+
                      "</div>"+
                    "</div>";
      });
      pollHtml += "<div style=\"font-size:11px;color:#888;text-align:right;\">"+totalVotes+" votes</div></div>";
    }

    const div = document.createElement("div");
    div.className = "post";
    div.id = "post-"+p.id;
    div.innerHTML =
      "<div class=\"post-header\">"+
        "<a href=\""+getUserPageLink(p.username)+"\" class=\"post-avatar-link\">"+
          "<img class=\"post-avatar\" src=\""+escapeHtml(pic)+"\" onerror=\"this.src='\''empty.jpg'\''\">"+
        "</a>"+
        "<div class=\"post-meta\">"+
          "<a href=\""+getUserPageLink(p.username)+"\" class=\"user-link\">@"+escapeHtml(p.username)+"</a>"+
          badges +
          (p.username!==currentUser
            ? " <button class=\"follow-btn "+(isFollowing?"following":"")+"\" onclick=\"follow('\''"+p.username+"'\'')\">"+(isFollowing?"Following":"+ Follow")+"</button>"
            : " <span class=\"you-tag\">you</span>")+
          "<div class=\"post-time\">"+timeAgo(p.created_at)+editedLabel+"</div>"+
        "</div>"+
        (isOwn ? "<span class=\"delete\" onclick=\"del("+p.id+")\"><span class=\"material-icons\" style=\"font-size:16px;\">close</span></span>" : "")+
      "</div>"+
      repostHtml +
      "<div class=\"post-text\" id=\"post-text-"+p.id+"\">"+renderPostText(p.text)+"</div>"+
      pollHtml +
      "<div class=\"post-actions\">"+
        "<span id=\"likes-"+p.id+"\" class=\"like-wrap\"><span class=\"heart"+(liked?" liked":"")+"\" onclick=\"like("+p.id+")\"><span class=\"material-icons\" style=\"font-size:18px;\">favorite</span></span> "+likeCount+" likes</span>"+
        "<span class=\"comment-toggle\" onclick=\"toggleComments("+p.id+")\"><span class=\"material-icons\" style=\"font-size:18px;\">mode_comment</span> "+commentCount+" comments</span>"+
        (currentUser ? " <span class=\"repost-btn\" onclick=\"repost("+p.id+",'\''"+p.username.replace(/'/g,"\\'")+"'\'')\" style=\"cursor:pointer;color:#555;\"><span class=\"material-icons\" style=\"font-size:18px;\">sync</span> Share</span>" : "")+
        (!isOwn ? "<span class=\"report-btn\" onclick=\"reportPost("+p.id+",'\''"+p.username.replace(/'/g,"\\'")+"'\'')\" style=\"margin-left:auto;\"><span class=\"material-icons\" style=\"font-size:16px;\">flag</span> Report</span>" : "")+
      "</div>"+
      "<div id=\"comments-"+p.id+"\" class=\"comment-box\" data-postid=\""+p.id+"\" style=\"display:none\">"+
        "<div class=\"comment-list\"></div>"+
        "<div class=\"comment-input\">"+
          "<input id=\"cinput-"+p.id+"\" placeholder=\"Write a comment...\" onkeydown=\"if(event.key==='\''Enter'\'')addComment("+p.id+")\">"+
          "<button onclick=\"addComment("+p.id+")\">Post</button>"+
        "</div>"+
      "</div>";
    feedEl.appendChild(div);
  }
}
