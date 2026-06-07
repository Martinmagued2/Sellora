---
Task ID: 1
Agent: Main
Task: Fix Sellora AI Agent - make it send reply messages and deliver customer messages

Work Log:
- Investigated the complete AI agent codebase: copilot-tools.js, tools.js, processor.js, meta.js, whatsapp/index.js, chat route, webhook routes
- Identified 3 critical bugs causing the agent to not send replies or deliver messages
- Bug 1: send_message_to_customer tool made HTTP fetch to itself (/api/messages/send) which failed on Vercel (DNS, cold starts, timeouts) - rewrote to call Meta/WhatsApp APIs directly
- Bug 2: Processor silently skipped delivery when accessToken was null - added resolveChannelToken() helper to look up tokens from accounts table
- Bug 3: System prompt didn't emphasize messaging customers - added explicit rules (guidelines 16-19)
- Also fixed token lookup for greeting, FAQ, and keyword reply delivery sections
- Added tool labels and fallback text for find_conversation, send_message_to_customer, send_follow_up in CopilotPanel
- Committed and pushed to main branch

Stage Summary:
- 4 files modified: copilot-tools.js, processor.js, chat/route.js, CopilotPanel.js
- Commit: 95bd673 "Fix AI Agent: send replies to customers & deliver messages"
- Deployment triggered on Vercel
- The agent should now: (1) actually deliver messages when asked to send to customers, (2) send AI auto-replies to customers on IG/FB/WA, (3) show clear error messages if channels are not connected
