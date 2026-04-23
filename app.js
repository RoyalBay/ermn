let currentUser = localStorage.getItem("currentUser");
let users = JSON.parse(localStorage.getItem("users")||"{}");

function save(){
  localStorage.setItem("users",JSON.stringify(users));
}

function ensure(u){
  if(!users[u]) return;
  users[u].followers ||= [];
  users[u].posts ||= [];
  users[u].pic ||= "";
}

/* POST */
function post(){
  let t=document.getElementById("text").value;
  if(!t) return;

  users[currentUser].posts.unshift({
    id:Date.now(),
    user:currentUser,
    text:t,
    time:new Date().toLocaleString(),
    likes:0,
    likedBy:[]
  });

  save();
  render();
  applyTheme();
}

/* LIKE */
function like(id){
  for(let u in users){
    for(let p of users[u].posts){
      if(p.id===id){

        p.likedBy ||= [];

        if(p.likedBy.includes(currentUser)){
          p.likedBy=p.likedBy.filter(x=>x!==currentUser);
        } else {
          p.likedBy.push(currentUser);
        }

        p.likes=p.likedBy.length;
      }
    }
  }

  save();
  render();
}

/* FOLLOW (UPDATED LIVE POPUP FIX) */
function follow(u){
  ensure(u);

  let list=users[u].followers;

  if(list.includes(currentUser)){
    users[u].followers=list.filter(x=>x!==currentUser);
  } else {
    list.push(currentUser);
  }

  save();
  render();

  // LIVE POPUP UPDATE
  if(popup.style.display==="block"){
    let name=pname.innerText.replace("@","");
    pfollow.innerText="Followers: "+users[name].followers.length;
  }
}

/* DELETE */
function del(id){
  users[currentUser].posts=
    users[currentUser].posts.filter(p=>p.id!==id);

  save();
  render();
}

/* UPLOAD PROFILE PIC */
function upload(file){
  let r=new FileReader();

  r.onload=()=>{
    users[currentUser].pic=r.result;
    save();
    render();
  };

  r.readAsDataURL(file);
}

/* OPEN PROFILE */
function openProfile(u){
  let p=users[u];
  if(!p) return;

  popup.style.display="block";
  pname.innerText="@"+u;
  ppic.src=p.pic||"";
  pfollow.innerText="Followers: "+p.followers.length;
}

/* RENDER */
function render(){
  let feed=document.getElementById("posts");
  if(!feed) return;

  feed.innerHTML="";

  for(let u in users){
    ensure(u);

    for(let p of users[u].posts){

      let div=document.createElement("div");
      div.className="post";

      let isFollow=users[p.user].followers.includes(currentUser);

      div.innerHTML=`
        <span class="user" onclick="openProfile('${p.user}')">
          @${p.user}
        </span>

        <button onclick="follow('${p.user}')">
          ${isFollow?"Unfollow":"Follow"}
        </button>

        <div>${p.text}</div>
        <small>${p.time}</small>

        <div onclick="like(${p.id})">
          ▲ ${p.likes}
        </div>

        ${p.user===currentUser?
          `<div class="delete" onclick="del(${p.id})">delete</div>`:""}
      `;

      feed.appendChild(div);
    }
  }

  if(users[currentUser]){
    rightName.innerText="@"+currentUser;
    rightFollowers.innerText="Followers: "+users[currentUser].followers.length;
    rightPic.src=users[currentUser].pic||"";
  }
}

render();
