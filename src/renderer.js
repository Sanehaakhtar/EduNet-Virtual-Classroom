// This file is the "renderer process" script. It controls the user interface.

// --- Get references to our HTML elements ---
const startBtn = document.getElementById('start-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video'); // Get the remote video element

let localStream;

// --- Camera Access Functionality ---
const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    console.log('Successfully accessed camera and microphone.');
    localStream = stream;
    localVideo.srcObject = stream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    alert('Could not access your camera. Please check permissions and ensure it is not in use.');
  }
};

startBtn.addEventListener('click', startCamera);


// ===================================================================
//                 WEBRTC TICKET SYSTEM (WITH VIDEO)
// ===================================================================

// --- 1. Get references to our HTML elements ---
const createTicketBtn = document.getElementById('create-ticket-btn');
const submitTicketBtn = document.getElementById('submit-ticket-btn');
const ticketTextarea = document.getElementById('ticket-textarea');
const sendBtn = document.getElementById('send-btn');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');

let peerConnection;
let dataChannel;

// A helper function to display messages in the chatbox
const appendMessage = (message, sender) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
};

// This function runs when we receive the video stream from the other peer
const setupVideoStream = (event) => {
    console.log('✅ Received remote video stream!');
    const [remoteStream] = event.streams;
    remoteVideo.srcObject = remoteStream;
};

// When the user clicks the "Send" button...
sendBtn.addEventListener('click', () => {
    const message = messageInput.value;
    if (message.trim() === '' || !dataChannel || dataChannel.readyState !== 'open') {
        return;
    }
    dataChannel.send(message);
    appendMessage(message, 'You');
    messageInput.value = '';
});


// --- 2. The "Create Ticket" Logic (for User A) ---
createTicketBtn.addEventListener('click', async () => {
    if (!localStream) {
        return alert('Please start your camera first!');
    }
    console.log('Creating a new connection ticket...');

    const iceCandidates = [];
    peerConnection = new RTCPeerConnection();
    
    // ** NEW **: Set up the event handler for incoming video
    peerConnection.ontrack = setupVideoStream;

    // ** NEW **: Add our local camera tracks to the connection to be sent
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    
    dataChannel = peerConnection.createDataChannel('chat');
    dataChannel.onopen = () => console.log('✅ Data channel is OPEN!');
    dataChannel.onmessage = (event) => appendMessage(event.data, 'Peer');

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            iceCandidates.push(event.candidate);
        }
    };

    peerConnection.onicegatheringstatechange = () => {
        if (peerConnection.iceGatheringState === 'complete') {
            console.log('ICE gathering is complete. Building ticket...');
            const ticket = {
                offer: peerConnection.localDescription,
                iceCandidates: iceCandidates,
            };
            ticketTextarea.value = JSON.stringify(ticket);
        }
    };
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
});


// --- 3. The "Submit Ticket" Logic (for User B and User A) ---
submitTicketBtn.addEventListener('click', async () => {
    if (!localStream && !peerConnection) {
        // This check is mainly for User B, ensuring their camera is on.
        return alert('Please start your camera first!');
    }
    if (!ticketTextarea.value) return alert('Please paste a ticket first!');

    const ticket = JSON.parse(ticketTextarea.value);

    // If the ticket has an "offer", we are User B.
    if (ticket.offer) {
        console.log('Received an offer ticket. Processing...');
        
        const iceCandidates = [];
        peerConnection = new RTCPeerConnection();
        
        // ** NEW **: Set up the event handler for incoming video
        peerConnection.ontrack = setupVideoStream;

        // ** NEW **: Add our local camera tracks to the connection to be sent
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) iceCandidates.push(event.candidate);
        };

        peerConnection.onicegatheringstatechange = () => {
            if (peerConnection.iceGatheringState === 'complete') {
                console.log('ICE gathering complete for answerer. Building confirmation ticket...');
                const confirmationTicket = {
                    answer: peerConnection.localDescription,
                    iceCandidates: iceCandidates,
                };
                ticketTextarea.value = JSON.stringify(confirmationTicket);
            }
        };

        peerConnection.ondatachanel = (event) => {
            dataChannel = event.channel;
            dataChannel.onopen = () => console.log('✅ Data channel is OPEN!');
            dataChannel.onmessage = (event) => appendMessage(event.data, 'Peer');
        };

        await peerConnection.setRemoteDescription(ticket.offer);
        
        for (const candidate of ticket.iceCandidates) {
            await peerConnection.addIceCandidate(candidate);
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

    // If the ticket has an "answer", we are User A finalizing the connection.
    } else if (ticket.answer) {
        console.log('Received a confirmation ticket. Finalizing connection...');
        
        await peerConnection.setRemoteDescription(ticket.answer);
        
        for (const candidate of ticket.iceCandidates) {
            await peerConnection.addIceCandidate(candidate);
        }
    }
});