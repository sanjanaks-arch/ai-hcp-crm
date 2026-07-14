import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Save, Sparkles, CheckCircle2 } from 'lucide-react';

interface FormState {
  hcp_name: string;
  interaction_type: string;
  date: string;
  time: string;
  attendees: string;
  topics_discussed: string;
  materials_shared: string;
  samples_distributed: string;
  sentiment: string;
  outcomes: string;
  followup_actions: string;
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  toolExecuted?: string;
}

export default function App() {
  // Form state holding the active structured log
  const [form, setForm] = useState<FormState>({
    hcp_name: '',
    interaction_type: 'Meeting',
    // ⚡ Automatically default to today's local date format on load!
    date: new Date().toISOString().split('T')[0],
    time: '',
    attendees: '',
    topics_discussed: '',
    materials_shared: '', // ⚡ Fixed missing property initialization string
    samples_distributed: '', // ⚡ Fixed missing property initialization string
    sentiment: 'Neutral',
    outcomes: '',
    followup_actions: '',
  });

  // Chat message feed
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: 'Hello! I am your AI CRM Assistant. You can describe your doctor meeting here (e.g. "I met Dr. Smith today at 2 PM to discuss Product X, she liked it but wanted samples"), and I will fill out the log automatically!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle manual edits to form fields
  const handleInputChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Send message to FastAPI Backend Chat
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input;
    setMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userQuery,
          current_form_state: form
        }),
      });

      if (!response.ok) throw new Error("Failed to communicate with the agent backend");
      
      const data = await response.json();

      // Append AI's textual response
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: data.reply,
        toolExecuted: data.detected_tool || undefined
      }]);

      // Apply any structured tool updates to the form fields
      if (data.tool_updates) {
        if (data.detected_tool === 'LOG_INTERACTION') {
          setForm(prev => ({
            ...prev,
            ...data.tool_updates
          }));
        } else if (data.detected_tool === 'EDIT_INTERACTION') {
          const { field, value } = data.tool_updates;
          if (field in form) {
            setForm(prev => ({ ...prev, [field]: value }));
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I ran into an issue connecting to my backend agent." }]);
    } finally {
      setLoading(false);
    }
  };

  // Save interaction to SQLite database
  const handleSaveForm = async () => {
    setSaveStatus("Saving...");
    try {
      const response = await fetch('http://127.0.0.1:8000/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error("Could not save to database.");

      setSaveStatus("Saved Successfully!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus("Error saving interaction.");
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-teal-400 w-6 h-6 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">
            AI-First HCP CRM
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">Backend Server: <span className="text-teal-400 font-semibold">Active</span></span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Structured Form Layout */}
        <section className="w-1/2 p-6 flex flex-col overflow-y-auto border-r border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold">HCP Interaction Logger</h2>
              <p className="text-xs text-slate-400">Review structured details extracted directly from your conversation</p>
            </div>
            <button
              onClick={handleSaveForm}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 active:scale-95 transition-transform text-slate-950 font-bold rounded-lg text-sm shadow-md"
            >
              <Save className="w-4 h-4" />
              Save Record
            </button>
          </div>

          {saveStatus && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${saveStatus.includes("Error") ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              <CheckCircle2 className="w-4 h-4" />
              {saveStatus}
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">HCP Name (Doctor)</label>
              <input
                type="text"
                value={form.hcp_name}
                onChange={(e) => handleInputChange('hcp_name', e.target.value)}
                placeholder="Dr. Name"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Interaction Type</label>
              <select
                value={form.interaction_type}
                onChange={(e) => handleInputChange('interaction_type', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              >
                <option value="Meeting">Meeting</option>
                <option value="Email">Email</option>
                <option value="Phone Call">Phone Call</option>
                <option value="Lunch & Learn">Lunch & Learn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Sentiment State</label>
              <select
                value={form.sentiment}
                onChange={(e) => handleInputChange('sentiment', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              >
                <option value="Positive">Positive</option>
                <option value="Neutral">Neutral</option>
                <option value="Negative">Negative</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Date</label>
              <input
                type="text"
                placeholder="YYYY-MM-DD"
                value={form.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Time</label>
              <input
                type="text"
                placeholder="HH:MM AM/PM"
                value={form.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Attendees</label>
              <input
                type="text"
                placeholder="Staff names or companions present"
                value={form.attendees}
                onChange={(e) => handleInputChange('attendees', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Topics Discussed</label>
              <textarea
                rows={2}
                placeholder="Main conversation focus..."
                value={form.topics_discussed}
                onChange={(e) => handleInputChange('topics_discussed', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200 resize-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Follow-up Actions</label>
              <textarea
                rows={2}
                placeholder="What action steps need to happen next?"
                value={form.followup_actions}
                onChange={(e) => handleInputChange('followup_actions', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 focus:border-teal-500 focus:outline-none text-slate-200 resize-none"
              />
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: AI Chat Panel */}
        <section className="w-1/2 flex flex-col bg-slate-950">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <span className="font-semibold text-sm">Copilot Chat Session</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-teal-400 font-mono">Agent Powered</span>
          </div>

          {/* Messages Frame */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender !== 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
                    <Bot className="w-5 h-5" />
                  </div>
                )}
                
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${msg.sender === 'user' ? 'bg-teal-500 text-slate-950 rounded-tr-none font-medium' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800/80'}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  {msg.toolExecuted && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center gap-1.5 text-[10px] text-teal-400 font-mono">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Executed tool: {msg.toolExecuted}</span>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center shrink-0 border border-slate-700">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20 animate-pulse">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form Input Frame */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900/30 flex gap-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 'Logged a meeting with Dr. Evan Smith today at 3pm, we discussed Product X.'"
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-teal-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded-xl flex items-center justify-center transition-colors shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}