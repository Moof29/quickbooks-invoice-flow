/**
 * Utility to unregister all service workers
 * Useful for clearing aggressive PWA caching
 */
export const clearAllServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    for (const registration of registrations) {
      await registration.unregister();
      console.log('Service worker unregistered:', registration.scope);
    }
    
    // Also clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared:', cacheNames);
    }
    
    console.log('✅ All service workers and caches cleared. Please refresh the page.');
    return true;
  }
  
  console.log('Service workers not supported');
  return false;
};

// Add to window for console access
if (typeof window !== 'undefined') {
  (window as any).clearServiceWorkers = clearAllServiceWorkers;
}
