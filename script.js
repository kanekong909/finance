const SUPABASE_URL = 'https://xmlzitpgfkjsmrpfqmex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbHppdHBnZmtqc21ycGZxbWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NzYxOTYsImV4cCI6MjA4MDU1MjE5Nn0.kwKihIcDD_9KfXM0IDhdTdKM0s0aDdp5suqMYoEYErM';

// ESTA ES LA LÍNEA CORRECTA
// ESTA LÍNEA ES LA QUE FUNCIONA SIEMPRE
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentExpenseId = null;

// Elementos
const authSection = document.getElementById('auth-section');
const expensesSection = document.getElementById('expenses-section');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const expensesList = document.getElementById('expenses-list');

async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        authSection.style.display = 'none';
        expensesSection.style.display = 'block';
        logoutBtn.style.display = 'block';

        // Mostrar nombre o correo
        userInfo.textContent = user.email;
        if (user.user_metadata?.full_name) {
            userInfo.textContent = user.user_metadata.full_name + ` (${user.email})`;
        }

        loadExpenses();
    } else {
        authSection.style.display = 'block';
        expensesSection.style.display = 'none';
        logoutBtn.style.display = 'none';
        userInfo.textContent = '';
    }
}

// Login / Registro / Logout
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error: ' + error.message);
    else checkAuth();
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert('Error: ' + error.message);
    else alert('Registro exitoso. Revisa tu correo y luego inicia sesión.');
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkAuth();
});

// Agregar gasto
document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value.trim();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from('expenses')
        .insert({ user_id: user.id, amount, description });

    if (!error) {
        document.getElementById('amount').value = '';
        document.getElementById('description').value = '';
        loadExpenses();
    } else alert('Error: ' + error.message);
});

// CARGAR GASTOS (con event delegation → nunca se pierden los clics)
async function loadExpenses() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    expensesList.innerHTML = '';

    if (error || !data || data.length === 0) {
        expensesList.innerHTML = `<div style="text-align:center;padding:80px 20px;color:#94a3b8;font-size:1.1rem;">Aún no tienes gastos registrados</div>`;
        document.getElementById('summary-card').style.display = 'none';
        return;
    }

    // Total mensual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalMonth = data
        .filter(d => new Date(d.created_at) >= monthStart)
        .reduce((s, d) => s + parseFloat(d.amount), 0);

    document.getElementById('monthly-total').textContent = 
        '$' + totalMonth.toLocaleString('es-CO', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    document.getElementById('summary-card').style.display = 'block';

        // Renderizar gastos
        data.forEach((exp, i) => {
        const div = document.createElement('div');
        div.className = 'expense-item';
        div.style.animationDelay = `${i * 0.06}s`;

        // Fecha bonita: "Vie 5 dic"
        const date = new Date(exp.created_at);
        const formattedDate = date.toLocaleDateString('es-CO', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        })
        .replace(/\./g, '')                    // quita el punto del día
        .replace(/^\w/, c => c.toUpperCase());  // primera letra mayúscula

        // Monto limpio: $22.500 (sin decimales ni "COP")
        const amount = exp.amount.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });

        div.innerHTML = `
            <div class="expense-main">
                <div class="expense-description">${exp.description || 'Sin descripción'}</div>
                <div class="expense-date">${formattedDate}</div>
            </div>
            <div class="expense-amount">$${amount}</div>
            <div class="expense-actions">
                <button class="edit-btn" data-id="${exp.id}" 
                        data-desc="${exp.description || ''}" 
                        data-amount="${exp.amount}">
                    Editar
                </button>
                <button class="delete-btn" data-id="${exp.id}">
                    Eliminar
                </button>
            </div>
        `;

        expensesList.appendChild(div);
        }); // AQUÍ ESTABA FALTANDO ESTA LLAVE
}

// EVENT DELEGATION → Los botones funcionan aunque se regeneren
expensesList.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn') || e.target.closest('.edit-btn')) {
        const btn = e.target.closest('.edit-btn');
        currentExpenseId = btn.dataset.id;
        document.getElementById('edit-description').value = btn.dataset.desc;
        document.getElementById('edit-amount').value = btn.dataset.amount;
        document.getElementById('edit-modal').classList.add('active');
    }

    if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
        currentExpenseId = e.target.closest('.delete-btn').dataset.id;
        document.getElementById('delete-modal').classList.add('active');
    }
});

// Cerrar modales
document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
    btn.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('active');
    };
});

// Guardar edición
document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const desc = document.getElementById('edit-description').value.trim();
    const amount = parseFloat(document.getElementById('edit-amount').value);

    if (!desc || isNaN(amount)) return;

    const { error } = await supabase
        .from('expenses')
        .update({ description: desc, amount })
        .eq('id', currentExpenseId);

    if (!error) {
        document.getElementById('edit-modal').classList.remove('active');
        loadExpenses();
    }
};

// Confirmar eliminación
document.getElementById('confirm-delete-btn').onclick = async () => {
    await supabase.from('expenses').delete().eq('id', currentExpenseId);
    document.getElementById('delete-modal').classList.remove('active');
    loadExpenses();
};

// Iniciar app
checkAuth();