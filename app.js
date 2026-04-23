const SUPABASE_URL = "https://kibepwdosrjxbauxnjtn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpYmVwd2Rvc3JqeGJhdXhuanRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDczMzAsImV4cCI6MjA5MjQ4MzMzMH0._bfs8jCBRSKCkHJ6T-0SIl2j_TnGliAW6zw7OLl08Sk";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = localStorage.getItem("currentUser");

/* THEME */
function applyTheme() {
  const t = localStorage.getItem("theme") || "light";
  const feed = document.querySelector(".feed");
  const profile = document.querySelector(".profile");
  document.body.style.transition = "background 0.3s ease";
  if (t === "dark") {
    document.body.style.background = "#1e1e1e";
    document.body.style.color = "white";
    if (feed) feed.style.background = "#2b2b2b";
    if (profile) profile.style.background = "#2b2b2b";
  } else if (t === "light") {
    document.body.style.background = "#f5f6f7";
    document.body.style.color = "black";
    if (feed) feed.style.background = "white";
    if (profile) profile.style.background = "white";
  } else if (t === "dynamic") {
    const t0 = Date.now() / 800;
    const r = Math.floor(128 + 127 * Math.sin(t0));
    const g = Math.floor(128 + 127 * Math.sin(t0 + 2));
    const b = Math.floor(128 + 127 * Math.sin(t0 + 4));
    document.body.style.background = "rgb(" + r + "," + g + "," + b + ")";
  }
}

/* POST */
async function post() {
  const textEl = document.getElementById("text");
  const t = textEl.value.trim();
  if (!t) return;
  const { error } = await sb.from("posts").insert({ username: currentUser, text: t });
  if (error) { alert("Error posting: " + error.message); return; }
  textEl.value = "";
  await render();
}

/* LIKE */
async function like(postId) {
  const { data: existing } = await sb.from("likes")
    .select("post_id").eq("post_id", postId).eq("username", currentUser).maybeSingle();
  if (existing) {
    await sb.from("likes").delete().eq("post_id", postId).eq("username", currentUser);
  } else {
    await sb.from("likes").insert({ post_id: postId, username: currentUser });
  }
  await render();
}

/* FOLLOW */
async function follow(targetUser) {
  const { data: existing } = await sb.from("follows")
    .select("follower").eq("follower", currentUser).eq("following", targetUser).maybeSingle();
  if (existing) {
    await sb.from("follows").delete().eq("follower", currentUser).eq("following", targetUser);
  } else {
    await sb.from("follows").insert({ follower: currentUser, following: targetUser });
  }
  await render();
  const popup = document.getElementById("popup");
  if (popup && popup.style.display === "block") {
    const shown = document.getElementById("pname").innerText.replace("@", "");
    if (shown === targetUser) await openProfile(targetUser);
  }
}

/* DELETE */
async function del(postId) {
  await sb.from("posts").delete().eq("id", postId).eq("username", currentUser);
  await render();
}

/* UPLOAD PROFILE PIC */
async function upload(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const { error } = await sb.from("users").update({ pic: reader.result }).eq("username", currentUser);
    if (error) { alert("Error uploading pic: " + error.message); return; }
    await render();
  };
  reader.readAsDataURL(file);
}

/* OPEN POPUP PROFILE */
async function openProfile(u) {
  const popup = document.getElementById("popup");
  if (!popup) return;
  const { data: user } = await sb.from("users").select("pic").eq("username", u).maybeSingle();
  const { count: followerCount } = await sb.from("follows")
    .select("*", { count: "exact", head: true }).eq("following", u);
  popup.style.display = "block";
  document.getElementById("pname").innerText = "@" + u;
  document.getElementById("ppic").src = (user && user.pic) || "";
  document.getElementById("pfollow").innerText = "Followers: " + (followerCount || 0);
}

/* ESCAPE HTML */
function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

/* RENDER FEED */
async function render() {
  const feed = document.getElementById("posts");
  if (!feed) return;

  const { data: posts, error } = await sb.from("posts")
    .select("id, username, text, created_at")
    .order("created_at", { ascending: false });
  if (error) { feed.innerHTML = "<p>Error loading posts.</p>"; return; }

  const [{ data: myLikes }, { data: myFollows }, { data: allLikes }] = await Promise.all([
    sb.from("likes").select("post_id").eq("username", currentUser),
    sb.from("follows").select("following").eq("follower", currentUser),
    sb.from("likes").select("post_id")
  ]);

  const likedSet = new Set((myLikes || []).map(l => l.post_id));
  const followSet = new Set((myFollows || []).map(f => f.following));
  const likeMap = {};
  (allLikes || []).forEach(l => { likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1; });

  feed.innerHTML = "";
  for (const p of (posts || [])) {
    const div = document.createElement("div");
    div.className = "post";
    const isFollowing = followSet.has(p.username);
    const liked = likedSet.has(p.id);
    const likeCount = likeMap[p.id] || 0;
    const date = new Date(p.created_at).toLocaleString();
    div.innerHTML =
      '<span class="user" onclick="openProfile(\'' + p.username + '\')">@' + p.username + '</span> ' +
      (p.username !== currentUser ? '<button onclick="follow(\'' + p.username + '\')">' + (isFollowing ? "Unfollow" : "Follow") + '</button>' : '') +
      '<div style="margin:6px 0;">' + escapeHtml(p.text) + '</div>' +
      '<small>' + date + '</small>' +
      '<div onclick="like(' + p.id + ')" style="cursor:pointer;margin-top:4px;color:' + (liked ? "#e74c3c" : "inherit") + '">&#9650; ' + likeCount + '</div>' +
      (p.username === currentUser ? '<div class="delete" onclick="del(' + p.id + ')">delete</div>' : '');
    feed.appendChild(div);
  }

  const { data: me } = await sb.from("users").select("pic").eq("username", currentUser).maybeSingle();
  const { count: myFollowers } = await sb.from("follows")
    .select("*", { count: "exact", head: true }).eq("following", currentUser);

  const rightPic = document.getElementById("rightPic");
  const rightName = document.getElementById("rightName");
  const rightFollowers = document.getElementById("rightFollowers");
  if (rightPic) rightPic.src = (me && me.pic) || "";
  if (rightName) rightName.innerText = "@" + currentUser;
  if (rightFollowers) rightFollowers.innerText = "Followers: " + (myFollowers || 0);
}
