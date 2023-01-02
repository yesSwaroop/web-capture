'use strict';

//Defining some global utility variables
var isChannelReady = true;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var obtainedStream = false;
var connected = false;

//Initialize turn/stun server here
var pcConfig = turnConfig;

var localStreamConstraints = {
    audio: true,
    video: true
  };


//Not prompting for room name
//var room = 'foo';

// Prompting for room name:
var room = prompt('Enter room name:');

//Initializing socket.io
var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or  join room', room);
}

//Defining socket connections for signalling
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});


//Driver code
socket.on('message', function(message, room) {
    console.log('Client received message:', message,  room);
    if (message === 'got user media') {
      maybeStart();
    } else if (message.type === 'offer') {
      if (!isInitiator && !isStarted) {
        maybeStart();
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      doAnswer();
    } else if (message.type === 'answer' && isStarted) {
      pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });
      pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
      handleRemoteHangup();
    }
});
  


//Function to send message in a room
function sendMessage(message, room) {
  console.log('Client sending message: ', message, room);
  socket.emit('message', message, room);
}



//Displaying Local Stream and Remote Stream on webpage
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var canvas = document.querySelector("#canvas");
var capture = document.querySelector('#capture');
navigator.mediaDevices.getUserMedia(localStreamConstraints)
.then(gotStream)
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});


//If found local stream
function gotStream(stream) {
  console.log('Adding local stream.');
  obtainedStream = true;
  localStream = stream;
  localVideo.srcObject = stream;
  canvas.setAttribute("height",0);
  canvas.setAttribute("width",0);
  sendMessage('got user media', room);
}


console.log('Getting user media with constraints', localStreamConstraints);

//If initiator, create the peer connection
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    connected = true;
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

//Sending bye if user closes the window
window.onbeforeunload = function() {
  sendMessage('bye', room);
};


//Creating peer connection
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    connected = true;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

//Function to handle Ice candidates
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    }, room);
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription, room);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}


function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
  remoteVideo.srcObject = null;
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye',room);
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

/**************************MODIFICATIONS START HERE**************************/

var _frames = document.getElementById("frames");
var _interval = document.getElementById("interval");
var prev = document.getElementById("prev");
var next = document.getElementById("next");
var fno = document.getElementById("fno");
var ID, frames, totalFrameSize, currFrame = 1;

function takeSnapshot(frameCount) {
  if(obtainedStream) {
    if(frameCount>frames) {
      document.getElementById("localVideo").style.borderColor = "lightblue";
      clearInterval(ID);
      console.log(`Size of captured frames : ${totalFrameSize.toPrecision(4)}MB`);
      return;
    }
    canvas.setAttribute("height","480");
    canvas.setAttribute("width","640");
    fno.innerText = `${frameCount}/${frames}`;
    currFrame = frameCount;
    console.log(`Capturing Frame : ${frameCount}/${frames}`);
    const context = canvas.getContext("2d");
    context.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg");
    document.getElementById("preview").src = data;
    totalFrameSize += data.length/1024/1024;
    localStorage.setItem(currFrame,data);
    canvas.setAttribute("height",0);
    canvas.setAttribute("width",0);
  }
}

function captureFrames() {
  document.getElementById("localVideo").style.borderColor = "greenyellow";
  totalFrameSize = 0;
  var interval = _interval.value;
  var count = 1;
  localStorage.clear();
  frames = _frames.value;
  ID = setInterval(function(){takeSnapshot(count++)},interval);
}

capture.addEventListener("click",captureFrames);

prev.addEventListener("click",function(){
  if(currFrame===1) return;
  currFrame-=1;
  fno.innerText = `${currFrame}/${frames}`;
  document.getElementById("preview").src = localStorage[currFrame];
});

next.addEventListener("click",function(){

  if(currFrame === parseInt(frames)) return;
  currFrame+=1;
  fno.innerText = `${currFrame}/${frames}`;
  document.getElementById("preview").src = localStorage[currFrame];
});