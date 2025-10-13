import { Sidebar } from './components/Sidebar/Sidebar'
import { ChatWindow } from './components/Chat/ChatWindow'
import { RightPanel } from './components/RightPanel/RightPanel'

function App() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <ChatWindow />
      <RightPanel />
    </div>
  )
}

export default App
