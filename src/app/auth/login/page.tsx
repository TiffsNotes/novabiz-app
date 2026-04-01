import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f6] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-[#00a855] flex items-center justify-center">
            <span className="font-black text-white text-base" style={{ fontFamily: 'Cabinet Grotesk, sans-serif' }}>N</span>
          </div>
          <span className="font-black text-xl text-gray-900" style={{ fontFamily: 'Cabinet Grotesk, sans-serif', letterSpacing: '-0.03em' }}>NovaBiz OS</span>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border border-black/[0.07] rounded-2xl',
            },
          }}
        />
      </div>
    </div>
  )
}
