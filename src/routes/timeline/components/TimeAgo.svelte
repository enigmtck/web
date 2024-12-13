<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    
    export let timestamp: Date = new Date();
    
    let timeAgo = "";
    let intervalId: ReturnType<typeof setInterval>;
    
    function formatTimeAgo(date: Date): string {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
        if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w`;
        if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`;
        return `${Math.floor(seconds / 31536000)}y`;
    }
    
    function getUpdateInterval(date: Date): number {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 1000;          // Every second
        if (seconds < 3600) return 60000;       // Every minute
        if (seconds < 86400) return 3600000;    // Every hour
        if (seconds < 604800) return 86400000;  // Every day
        return 3600000 * 12;                    // Every 12 hours for older times
    }
    
    function update() {
        timeAgo = formatTimeAgo(timestamp);
        clearInterval(intervalId);
        intervalId = setInterval(update, getUpdateInterval(timestamp));
    }
    
    onMount(() => {
        update();
    });
    
    onDestroy(() => {
        clearInterval(intervalId);
    });
</script>

<time datetime={timestamp.toISOString()} title={timestamp.toLocaleString()}>
    {timeAgo}
</time>
