// DOM Elements - Screens
const welcomeScreen = document.getElementById('welcome-screen');
const setupScreen = document.getElementById('setup-screen');
const classroomScreen = document.getElementById('classroom-screen');

// DOM Elements - Welcome Screen
const hostBtn = document.getElementById('host-btn');
const joinBtn = document.getElementById('join-btn');

// DOM Elements - Setup Screen
const backBtn = document.getElementById('back-btn');
const setupTitle = document.getElementById('setup-title');
const hostView = document.getElementById('host-view');
const joinView = document.getElementById('join-view');
const createTicketBtn = document.getElementById('create-ticket-btn');
const ticketDisplay = document.getElementById('ticket-display');
const ticketTextarea = document.getElementById('ticket-textarea');
const copyTicketBtn = document.getElementById('copy-ticket-btn');
const answerInput = document.getElementById('answer-input');
const answerTextarea = document.getElementById('answer-textarea');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const receivedTicketTextarea = document.getElementById('received-ticket-textarea');
const processTicketBtn = document.getElementById('process-ticket-btn');
const answerDisplay = document.getElementById('answer-display');
const answerOutputTextarea = document.getElementById('answer-output-textarea');
const copyAnswerBtn = document.getElementById('copy-answer-btn');
const waitingMessage = document.getElementById('waiting-message');
const statusText = document.getElementById('status-text');

// DOM Elements - Classroom Screen
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startCameraBtn = document.getElementById('start-camera-btn');
const hangUpBtn = document.getElementById('hang-up-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// WebRTC Variables (use var so they are exposed on window for the popup)
var peerConnection;
var dataChannel;
var localStream;
let isPolite;

// ============================================
// SCREEN NAVIGATION
// ============================================
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
}

// ============================================
// CONNECTION STATUS
// ============================================
function updateStatus(connected) {
    const statusElements = document.querySelectorAll('.connection-status');
    statusElements.forEach(element => {
        element.className = connected ? 'connection-status status-connected' : 'connection-status status-disconnected';
    });
    statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

// ============================================
// WELCOME SCREEN HANDLERS
// ============================================
hostBtn.addEventListener('click', () => {
    setupTitle.textContent = 'Host a Session';
    hostView.style.display = 'block';
    joinView.style.display = 'none';
    showScreen(setupScreen);
});

joinBtn.addEventListener('click', () => {
    setupTitle.textContent = 'Join a Session';
    hostView.style.display = 'none';
    joinView.style.display = 'block';
    showScreen(setupScreen);
});

backBtn.addEventListener('click', () => {
    showScreen(welcomeScreen);
    resetSetupScreen();
});

function resetSetupScreen() {
    ticketDisplay.style.display = 'none';
    answerInput.style.display = 'none';
    answerDisplay.style.display = 'none';
    waitingMessage.style.display = 'none';
    ticketTextarea.value = '';
    answerTextarea.value = '';
    receivedTicketTextarea.value = '';
    answerOutputTextarea.value = '';
}

// ============================================
// WEBRTC SETUP
// ============================================
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    });
    
    // Log ICE gathering state changes
    peerConnection.onicegatheringstatechange = () => {
        console.log('ICE Gathering State:', peerConnection.iceGatheringState);
    };
    
    // Log ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE Connection State:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            showNotification('Connection failed. Please check your network and try again.', 'error');
        }
    };
    
    peerConnection.onnegotiationneeded = async () => {
        if (isPolite) return;
        try {
            console.log('Re-negotiation needed');
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({ type: 'offer', sdp: peerConnection.localDescription }));
            }
        } catch (err) {
            console.error('Negotiation error:', err);
        }
    };

    peerConnection.ontrack = (event) => {
        console.log('Received remote track');
        remoteVideo.srcObject = event.streams[0];
    };
    
    peerConnection.onicecandidate = (event) => {
        console.log('ICE Candidate:', event.candidate ? 'Found' : 'End of candidates');
        // ICE candidates are now embedded in the SDP, no need to send separately
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connecting') {
            updateStatus(false);
        } else if (peerConnection.connectionState === 'connected') {
            updateStatus(true);
            showNotification('🎉 Connection established! Opening classroom...');
            
            // --- THIS IS THE NEW, ROBUST LOGIC ---
            const classroomWindow = window.open('classroom.html', 'EduNet Classroom', 'width=1400,height=900');
            if (!classroomWindow) {
                return alert('Please allow popups to open the classroom window');
            }

            // Wait for the new window to fully load, then give it the connection.
            classroomWindow.onload = () => {
                // Check if the handshake function exists in the new window
                if (classroomWindow.initClassroom) {
                    // Call the function in the new window and pass it the objects
                    classroomWindow.initClassroom(peerConnection, dataChannel, localStream);
                    
                    // Hide or close the setup window now
                    // Option A: Hide it
                    document.body.style.display = 'none'; 
                    
                    // Option B: Close it (can sometimes be blocked by browser)
                    // window.close(); 
                } else {
                    alert('Error initializing classroom. Please try again.');
                }
            };
            // --- END OF NEW LOGIC ---

        } else if (peerConnection.connectionState === 'failed') {
            updateStatus(false);
            showNotification('Connection failed. Please try again.', 'error');
        } else if (peerConnection.connectionState === 'disconnected') {
            updateStatus(false);
            showNotification('Connection lost.', 'error');
        }
    };
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log('✅ DATA CHANNEL OPENED - Connection successful!');
        // Data channel opening means connection is truly established
        if (peerConnection.connectionState === 'connected') {
            appendMessage('Chat is now active!', 'System');
        }
    };
    
    dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        showNotification('Communication error occurred', 'error');
    };
    
    dataChannel.onclose = () => {
        console.log('Data channel closed');
    };
    
    dataChannel.onmessage = async (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            appendMessage(event.data, 'Peer');
            return;
        }

        if (msg.type === 'chat') {
            appendMessage(msg.message, 'Peer');
        } else if (msg.type === 'offer') {
            console.log('Received re-negotiation offer');
            await peerConnection.setRemoteDescription(msg.sdp);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            dataChannel.send(JSON.stringify({ type: 'answer', sdp: peerConnection.localDescription }));
        } else if (msg.type === 'answer') {
            console.log('Received re-negotiation answer');
            await peerConnection.setRemoteDescription(msg.sdp);
        } else if (msg.type === 'ice-candidate') {
            await peerConnection.addIceCandidate(msg.candidate);
        } else if (msg.type === 'bye') {
            showNotification('Peer ended the call', 'error');
            hangUp(false);
        }
    };
}

// ============================================
// HOST WORKFLOW
// ============================================
createTicketBtn.addEventListener('click', async () => {
    isPolite = false;
    setupPeerConnection();
    
    dataChannel = peerConnection.createDataChannel('chat');
    setupDataChannel();
    
    // Wait for ICE gathering to complete
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Wait for ICE gathering
    await waitForIceGathering();
    
    // Include all ICE candidates in the ticket
    ticketTextarea.value = JSON.stringify({ 
        type: 'offer', 
        sdp: peerConnection.localDescription 
    });
    ticketDisplay.style.display = 'block';
    answerInput.style.display = 'block';
    
    showNotification('Ticket created! Copy and share it.');
});

// Helper function to wait for ICE gathering
function waitForIceGathering() {
    return new Promise((resolve) => {
        if (peerConnection.iceGatheringState === 'complete') {
            resolve();
        } else {
            const checkState = () => {
                if (peerConnection.iceGatheringState === 'complete') {
                    peerConnection.removeEventListener('icegatheringstatechange', checkState);
                    resolve();
                }
            };
            peerConnection.addEventListener('icegatheringstatechange', checkState);
        }
    });
}

copyTicketBtn.addEventListener('click', () => {
    ticketTextarea.select();
    document.execCommand('copy');
    showNotification('Ticket copied to clipboard!');
});

submitAnswerBtn.addEventListener('click', async () => {
    const answerText = answerTextarea.value.trim();
    if (!answerText) {
        showNotification('Please paste the answer first!', 'error');
        return;
    }
    
    try {
        const answer = JSON.parse(answerText);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp));
        answerTextarea.value = '';
        
        // Show waiting state
        answerInput.style.display = 'none';
        const waitingCard = document.createElement('div');
        waitingCard.className = 'step-card';
        waitingCard.id = 'host-waiting-card';
        waitingCard.innerHTML = `
            <div class="step-number">✓</div>
            <h3>Connecting...</h3>
            <div class="loading-spinner"></div>
            <p class="instruction">Establishing secure peer-to-peer connection. This may take a few seconds...</p>
        `;
        hostView.appendChild(waitingCard);
        
        showNotification('Answer submitted! Connecting...');
        
        // Add timeout check
        setTimeout(() => {
            if (peerConnection.connectionState !== 'connected') {
                showNotification('Connection is taking longer than expected. Check console for details.', 'error');
                console.log('Connection State:', peerConnection.connectionState);
                console.log('ICE Connection State:', peerConnection.iceConnectionState);
                console.log('ICE Gathering State:', peerConnection.iceGatheringState);
            }
        }, 10000);
    } catch (error) {
        showNotification('Invalid answer format!', 'error');
        console.error(error);
    }
});

// ============================================
// JOIN WORKFLOW
// ============================================
processTicketBtn.addEventListener('click', async () => {
    const ticketText = receivedTicketTextarea.value.trim();
    if (!ticketText) {
        showNotification('Please paste a ticket first!', 'error');
        return;
    }
    
    try {
        const ticket = JSON.parse(ticketText);
        
        isPolite = true;
        setupPeerConnection();
        
        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel();
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(ticket.sdp));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Wait for ICE gathering
        await waitForIceGathering();

        answerOutputTextarea.value = JSON.stringify({ 
            type: 'answer', 
            sdp: peerConnection.localDescription 
        });
        answerDisplay.style.display = 'block';
        waitingMessage.style.display = 'block';
        
        showNotification('Answer generated! Copy and send it back.');
    } catch (error) {
        showNotification('Invalid ticket format!', 'error');
        console.error(error);
    }
});

copyAnswerBtn.addEventListener('click', () => {
    answerOutputTextarea.select();
    document.execCommand('copy');
    showNotification('Answer copied to clipboard!');
});

// ============================================
// CLASSROOM FUNCTIONALITY
// ============================================
startCameraBtn.addEventListener('click', async () => {
    if (localStream) {
        showNotification('Camera already started!', 'error');
        return;
    }
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        
        if (peerConnection) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }
        
        showNotification('Camera started!');
        startCameraBtn.textContent = '✅ Camera On';
    } catch (error) {
        showNotification('Could not access camera!', 'error');
        console.error(error);
    }
});

// Chat functionality
function appendMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (!message || !dataChannel || dataChannel.readyState !== 'open') {
        showNotification('Cannot send message. Not connected.', 'error');
        return;
    }
    
    dataChannel.send(JSON.stringify({ type: 'chat', message: message }));
    appendMessage(message, 'You');
    messageInput.value = '';
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});

// Hang up
function hangUp(notifyPeer = true) {
    if (peerConnection) {
        if (notifyPeer && dataChannel && dataChannel.readyState === 'open') {
            dataChannel.send(JSON.stringify({ type: 'bye' }));
        }
        peerConnection.close();
        peerConnection = null;
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    chatMessages.innerHTML = '';
    updateStatus(false);
    
    showScreen(welcomeScreen);
    resetSetupScreen();
    showNotification('Call ended');
}

hangUpBtn.addEventListener('click', () => hangUp(true));