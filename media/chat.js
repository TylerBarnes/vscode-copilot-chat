(function() {
    const vscode = acquireVsCodeApi();
    
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const newChatBtn = document.getElementById('newChatBtn');

    let messages = [];

    // Utility function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize
    function init() {
        console.log('[Webview] Initializing...');
        // Set up event listeners
        sendBtn.addEventListener('click', sendMessage);
        newChatBtn.addEventListener('click', startNewChat);
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Listen for messages from extension
        window.addEventListener('message', handleExtensionMessage);

        console.log('[Webview] Sending ready message to extension');
        // Notify extension that webview is ready
        vscode.postMessage({ type: 'ready' });

        // Show empty state initially
        showEmptyState();
        console.log('[Webview] Initialization complete');
    }

    function handleExtensionMessage(event) {
        const message = event.data;
        console.log('[Webview] Received message from extension:', message.type, message);
        
        switch (message.type) {
            case 'updateMessages':
                console.log('[Webview] Updating messages:', message.messages?.length || 0);
                console.log('[Webview] Messages data:', JSON.stringify(message.messages, null, 2));
                messages = message.messages;
                renderMessages();
                break;
            case 'showMessage':
                console.log('[Webview] Showing message:', message.message, message.messageType);
                showExtensionMessage(message.message, message.messageType || 'info');
                break;
        }
    }

	function sendMessage() {
		const text = messageInput.value.trim();
		if (!text) {
			return;
		}

		vscode.postMessage({
			type: 'sendMessage',
			text: text
		});

		messageInput.value = '';
		messageInput.focus();
	}

	function startNewChat() {
		vscode.postMessage({ type: 'newChat' });
	}

	function renderMessages() {
		if (messages.length === 0) {
			showEmptyState();
			return;
		}

		messagesContainer.innerHTML = '';
		
		messages.forEach(message => {
			const messageEl = createMessageElement(message);
			messagesContainer.appendChild(messageEl);
		});

		// Scroll to bottom
		messagesContainer.scrollTop = messagesContainer.scrollHeight;
	}

	function createMessageElement(message) {
		const messageEl = document.createElement('div');
		messageEl.className = `message ${message.role}`;

		// Message header
		const headerEl = document.createElement('div');
		headerEl.className = 'message-header';
		
		const roleEl = document.createElement('span');
		roleEl.className = `message-role ${message.role}`;
		roleEl.textContent = message.role === 'user' ? 'You' : 'Assistant';
		
		const timestampEl = document.createElement('span');
		timestampEl.className = 'message-timestamp';
		timestampEl.textContent = formatTimestamp(message.timestamp);
		
		headerEl.appendChild(roleEl);
		headerEl.appendChild(timestampEl);
		messageEl.appendChild(headerEl);

		// Thinking steps (if present)
		if (message.thinking && message.thinking.length > 0) {
			const thinkingEl = createThinkingElement(message.thinking);
			messageEl.appendChild(thinkingEl);
		}

		// Agent plan (if present)
		if (message.plan) {
			const planEl = createPlanElement(message.plan);
			messageEl.appendChild(planEl);
		}

// Message content
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        console.log('[Webview] createMessageElement - message.content:', message.content);
        console.log('[Webview] createMessageElement - content type:', typeof message.content);
        console.log('[Webview] createMessageElement - is array:', Array.isArray(message.content));
        
        // Handle content blocks or plain string content
        if (Array.isArray(message.content)) {
            console.log('[Webview] Processing content blocks array, length:', message.content.length);
            // Content blocks - render text blocks
            message.content.forEach((block, idx) => {
                console.log('[Webview] Block', idx, ':', block);
                if (block.type === 'text') {
                    const textEl = document.createElement('div');
                    textEl.textContent = block.text;
                    console.log('[Webview] Added text block:', block.text);
                    contentEl.appendChild(textEl);
                }
            });
        } else if (typeof message.content === 'string') {
            console.log('[Webview] Processing string content:', message.content);
            contentEl.textContent = message.content;
        } else {
            console.log('[Webview] Unknown content type!');
        }
        
        console.log('[Webview] contentEl.innerHTML:', contentEl.innerHTML);
        messageEl.appendChild(contentEl);

		// Tool calls (if present)
		if (message.toolCalls && message.toolCalls.length > 0) {
			const toolCallsEl = createToolCallsElement(message.toolCalls);
			messageEl.appendChild(toolCallsEl);
		}

		return messageEl;
	}

	function createThinkingElement(thinking) {
		const thinkingEl = document.createElement('div');
		thinkingEl.className = 'thinking-steps';
		
		const headerEl = document.createElement('div');
		headerEl.className = 'thinking-steps-header';
		headerEl.textContent = '💭 Thinking...';
		thinkingEl.appendChild(headerEl);

		thinking.forEach(step => {
			const stepEl = document.createElement('div');
			stepEl.className = 'thinking-step';
			stepEl.textContent = step;
			thinkingEl.appendChild(stepEl);
		});

		return thinkingEl;
	}

	function createPlanElement(plan) {
		const planEl = document.createElement('div');
		planEl.className = 'agent-plan';
		
		const headerEl = document.createElement('div');
		headerEl.className = 'agent-plan-header';
		headerEl.textContent = '📋 Plan';
		planEl.appendChild(headerEl);

		const contentEl = document.createElement('div');
		contentEl.textContent = JSON.stringify(plan, null, 2);
		planEl.appendChild(contentEl);

		return planEl;
	}

	function createToolCallsElement(toolCalls) {
		const toolCallsEl = document.createElement('div');
		toolCallsEl.className = 'tool-calls';

		toolCalls.forEach(toolCall => {
			const toolCallEl = document.createElement('div');
			toolCallEl.className = 'tool-call';
			
			const headerEl = document.createElement('div');
			headerEl.className = 'tool-call-header';
			headerEl.textContent = `🔧 ${toolCall.name}`;
			toolCallEl.appendChild(headerEl);

			const inputEl = document.createElement('div');
			inputEl.textContent = JSON.stringify(toolCall.input, null, 2);
			toolCallEl.appendChild(inputEl);

			// Action buttons
			const actionsEl = document.createElement('div');
			actionsEl.className = 'tool-call-actions';
			
			const approveBtn = document.createElement('button');
			approveBtn.className = 'tool-call-btn approve';
			approveBtn.textContent = 'Approve';
			approveBtn.onclick = () => {
				vscode.postMessage({
					type: 'approveTool',
					toolCallId: toolCall.id
				});
			};
			
			const rejectBtn = document.createElement('button');
			rejectBtn.className = 'tool-call-btn reject';
			rejectBtn.textContent = 'Reject';
			rejectBtn.onclick = () => {
				vscode.postMessage({
					type: 'rejectTool',
					toolCallId: toolCall.id
				});
			};
			
			actionsEl.appendChild(approveBtn);
			actionsEl.appendChild(rejectBtn);
			toolCallEl.appendChild(actionsEl);

			toolCallsEl.appendChild(toolCallEl);
		});

		return toolCallsEl;
	}

function showEmptyState() {
        messagesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">Start a conversation with your ACP agent</div>
                <div class="empty-state-hint">Type a message below to begin</div>
            </div>
        `;
    }

    function showExtensionMessage(message, messageType = 'info') {
        // Create a message element for extension messages
        const messageDiv = document.createElement('div');
        messageDiv.className = `message system ${messageType}`;
        
        const icon = messageType === 'error' ? '❌' : messageType === 'warning' ? '⚠️' : 'ℹ️';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${icon}</div>
            <div class="message-content">
                <div class="message-role">System</div>
                <div class="message-text">${escapeHtml(message)}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function formatTimestamp(timestamp) {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		
		// Less than 1 minute
		if (diff < 60000) {
			return 'Just now';
		}
		
		// Less than 1 hour
		if (diff < 3600000) {
			const minutes = Math.floor(diff / 60000);
			return `${minutes}m ago`;
		}
		
		// Less than 24 hours
		if (diff < 86400000) {
			const hours = Math.floor(diff / 3600000);
			return `${hours}h ago`;
		}
		
		// Show date
		return date.toLocaleDateString();
	}

	// Initialize on load
	init();
})();
