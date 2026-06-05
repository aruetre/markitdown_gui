// Notificaciones efímeras (toasts), visibles 3.5s.

const toastContainer = document.getElementById('toastContainer');

// Mostrar toast efímero (3.5s)
export function showToast(message, kind = 'ok') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${kind}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
