// Loader that chooses between Discord and standalone runtime
async function loadRuntime() {
  // Check if we're running inside Discord
  const isDiscord = window.location.search.includes('frame_id') || 
                    window.location.search.includes('instance_id') ||
                    window.parent !== window;
  
  if (isDiscord) {
    console.log('🎮 Loading Discord Activities runtime...');
    try {
      await import('./index.js');
    } catch (error) {
      console.error('Failed to load Discord runtime, falling back to standalone:', error);
      await import('./index.standalone.js');
    }
  } else {
    console.log('🌐 Loading standalone browser runtime...');
    await import('./index.standalone.js');
  }
}

// Start loading
loadRuntime().catch(error => {
  console.error('Failed to load runtime:', error);
  document.body.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;
      font-family: Arial, sans-serif;
      background: rgba(0,0,0,0.8);
      padding: 2rem;
      border-radius: 1rem;
    ">
      <div style="font-size: 2rem; margin-bottom: 1rem;">❌</div>
      <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">Failed to load GameVibe</div>
      <div style="font-size: 0.9rem; opacity: 0.8;">${error.message}</div>
    </div>
  `;
});