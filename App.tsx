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
  const [form, setForm] = useState<FormState>({
    hcp_name: '', interaction_type: 'Meeting', date: new Date().toISOString().split('T')[0],
    time: '', attendees: '', topics_discussed: '', materials_shared: '', samples_distributed: '',
    sentiment: 'Neutral', outcomes: '', followup_actions: '',
  });

  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: 'Hello! Your CRM AI Agent system is running with 5 operational tools connected directly to crm.db.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  const handleInputChange = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input;
    setMessages(prev => [...prev, { sender: 'user', text: userQuery }]);
    setInput('');
    setLoading(false);

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Please declare your local VITE_GROQ_API_KEY configuration variable." }]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `You are an agent coordinating 5 specific CRM tools. Reply strictly in JSON format.
              Options: "LOG_INTERACTION", "EDIT_INTERACTION", "CLEAR_FORM", "ADD_ATTENDEE", "UPDATE_SENTIMENT".
              Respond with: {"reply": "...", "detected_tool": "TOOL_NAME", "tool_updates": {fields to change}}`
            },
            { role: "user", content: `Current state: ${JSON.stringify(form)}\nCommand: "${userQuery}"` }
          ]
        })
      });

      const rawResult = await response.json();
      const payload = JSON.parse(rawResult.choices[0].message.content || "{}");
      const executedTool = payload.detected_tool || "LOG_INTERACTION";

      setMessages(prev => [...prev, { sender: 'bot', text: payload.reply, toolExecuted: executedTool }]);

      if (executedTool === 'CLEAR_FORM') {
        setForm({ hcp_name: '', interaction_type: 'Meeting', date: '', time: '', attendees: '', topics_discussed: '', materials_shared: '', samples_distributed: '', sentiment: 'Neutral', outcomes: '', followup_actions: '' });
      } else if (executedTool === 'ADD_ATTENDEE' && payload.tool_updates?.attendees) {
        setForm(prev => ({ ...prev, attendees: prev.attendees ? `${prev.attendees}, ${payload.tool_updates.attendees}` : payload.tool_updates.attendees }));
      } else if (payload.tool_updates) {
        setForm(prev => ({ ...prev, ...payload.tool_updates }));
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: "Pipeline connection failed." }]);
    } finally { setLoading(false); }
  };

  // ⚡ Updated to route directly to FastAPI backend server database target
  const handleSaveForm = async () => {
    setSaveStatus("Saving to crm.db database...");
    try {
      const response = await fetch('http://localhost:8000/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("Database transaction rejected.");
      setSaveStatus("Saved Successfully to crm.db! 🚀");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      setSaveStatus("Error connecting to active Python database engine.");
      setTimeout(() => setSaveStatus(null), 3500);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      <header className="bg-slate-950 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-teal-400 w-5 h-5 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">AI HCP CRM Modules</h1>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <section className="w-1/2 p-6 flex flex-col overflow-y-auto border-r border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold">Structured Metrics Form</h2>
              <p className="text-xs text-slate-400">Database synchronization pipeline</p>
            </div>
            <button onClick={handleSaveForm} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 font-bold rounded-lg text-sm text-slate-950 shadow-md">
              <Save className="w-4 h-4" /> Save Record
            </button>
          </div>
          {saveStatus && (
            <div className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${saveStatus.includes("Error") ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              <CheckCircle2 className="w-4 h-4" /> {saveStatus}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">HCP Name</label>
              <input type="text" value={form.hcp_name} onChange={(e) => handleInputChange('hcp_name', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Interaction Type</label>
              <select value={form.interaction_type} onChange={(e) => handleInputChange('interaction_type', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none">
                <option value="Meeting">Meeting</option><option value="Email">Email</option><option value="Phone Call">Phone Call</option><option value="Lunch & Learn">Lunch & Learn</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Sentiment</label>
              <select value={form.sentiment} onChange={(e) => handleInputChange('sentiment', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none">
                <option value="Positive">Positive</option><option value="Neutral">Neutral</option><option value="Negative">Negative</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Date</label>
              <input type="text" value={form.date} onChange={(e) => handleInputChange('date', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Time</label>
              <input type="text" value={form.time} onChange={(e) => handleInputChange('time', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Attendees</label>
              <input type="text" value={form.attendees} onChange={(e) => handleInputChange('attendees', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Topics Discussed</label>
              <textarea rows={2} value={form.topics_discussed} onChange={(e) => handleInputChange('topics_discussed', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none resize-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-slate-400 font-medium mb-1">Follow-up Actions</label>
              <textarea rows={2} value={form.followup_actions} onChange={(e) => handleInputChange('followup_actions', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-200 focus:outline-none resize-none" />
            </div>
          </div>
        </section>
        <section className="w-1/2 flex flex-col bg-slate-950">
          <div className="p-4 border-b border-slate-800"><span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Agent Graph Node Debugger</span></div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender !== 'user' && <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-teal-400 shrink-0"><Bot className="w-4 h-4" /></div>}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender === 'user' ? 'bg-teal-500 text-slate-950 rounded-tr-none font-medium' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.toolExecuted && <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] font-mono text-teal-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Tool Routed: {msg.toolExecuted}</div>}
                </div>
                {msg.sender === 'user' && <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-200 shrink-0"><User className="w-4 h-4" /></div>}
              </div>
            ))}
            {loading && <div className="text-xs text-slate-500 italic animate-pulse">Agent thinking...</div>}
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type interaction text notes here..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500" />
            <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 bg-teal-500 disabled:bg-slate-800 text-slate-950 rounded-xl font-bold flex items-center justify-center"><Send className="w-4 h-4" /></button>
          </form>
        </section>
      </main>
    </div>
  );
}