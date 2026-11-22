const signalingUrl = "wss://inai-col3.fishrungames.com/signaling/";
const iceServers = [
  { urls: "stun:stun.l.google.com:19302" }
];

const startButton = document.querySelector("#startButton");
const hangupButton = document.querySelector("#hangupButton");
const statusText = document.querySelector("#status");
const localVideo = document.querySelector("#localVideo");
const remoteVideo = document.querySelector("#remoteVideo");

let socket;
let peerConnection;
let localStream;
let myId;
let pendingCandidates = [];

function setStatus(message) {
  statusText.textContent = message;
}

function sendMessage(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

async function startCall() {
  startButton.disabled = true;
  hangupButton.disabled = false;
  setStatus("Запрашиваем доступ к камере и микрофону...");

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;
    connectToSignaling();
  } catch (error) {
    console.error(error);
    setStatus("Не удалось получить доступ к камере или микрофону.");
    stopCall();
  }
}

function connectToSignaling() {
  setStatus("Подключаемся к серверу...");
  socket = new WebSocket(signalingUrl);

  socket.addEventListener("open", () => {
    myId = Math.random().toString(36).slice(2);
    sendMessage({ type: "hello", id: myId });
    setStatus("Ожидаем собеседника...");
  });

  socket.addEventListener("message", async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error("Не удалось прочитать сообщение сервера", error);
      return;
    }

    await handleMessage(message);
  });

  socket.addEventListener("close", () => {
    if (localStream) {
      setStatus("Соединение с сервером закрыто.");
      stopCall();
    }
  });

  socket.addEventListener("error", () => {
    setStatus("Не удалось подключиться к серверу.");
  });
}

function createPeerConnection() {
  if (peerConnection) return;

  peerConnection = new RTCPeerConnection({ iceServers });

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.addEventListener("track", (event) => {
    remoteVideo.srcObject = event.streams[0];
  });

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate) {
      sendMessage({ type: "candidate", candidate: event.candidate });
    }
  });

  peerConnection.addEventListener("connectionstatechange", () => {
    if (peerConnection.connectionState === "connected") {
      setStatus("Звонок подключён.");
    }
  });
}

async function handleMessage(message) {
  if (message.type === "hello") {
    createPeerConnection();

    // Один клиент создаёт offer. Сравнение ID помогает выбрать его одинаково на обоих окнах.
    if (myId > message.id) {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendMessage({ type: "offer", offer });
      setStatus("Вызываем собеседника...");
    }
  }

  if (message.type === "offer") {
    createPeerConnection();
    await peerConnection.setRemoteDescription(message.offer);
    await addPendingCandidates();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    sendMessage({ type: "answer", answer });
    setStatus("Подключаемся к собеседнику...");
  }

  if (message.type === "answer" && peerConnection) {
    await peerConnection.setRemoteDescription(message.answer);
    await addPendingCandidates();
  }

  if (message.type === "candidate" && peerConnection) {
    if (peerConnection.remoteDescription) {
      await addCandidate(message.candidate);
    } else {
      pendingCandidates.push(message.candidate);
    }
  }

  if (message.type === "peer-left") {
    closePeerConnection();
    pendingCandidates = [];
    setStatus("Собеседник отключился. Ожидаем нового собеседника...");
  }
}

async function addPendingCandidates() {
  for (const candidate of pendingCandidates) {
    await addCandidate(candidate);
  }
  pendingCandidates = [];
}

async function addCandidate(candidate) {
  try {
    await peerConnection.addIceCandidate(candidate);
  } catch (error) {
    console.error("Не удалось добавить ICE candidate", error);
  }
}

function closePeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
}

function stopCall() {
  closePeerConnection();
  pendingCandidates = [];

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }

  localVideo.srcObject = null;

  if (socket && socket.readyState !== WebSocket.CLOSED) {
    socket.close();
  }
  socket = null;

  startButton.disabled = false;
  hangupButton.disabled = true;
}

startButton.addEventListener("click", startCall);
hangupButton.addEventListener("click", () => {
  stopCall();
  setStatus("Звонок завершён.");
});

