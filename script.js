const SUPABASE_URL = 'https://xmlzitpgfkjsmrpfqmex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbHppdHBnZmtqc21ycGZxbWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NzYxOTYsImV4cCI6MjA4MDU1MjE5Nn0.kwKihIcDD_9KfXM0IDhdTdKM0s0aDdp5suqMYoEYErM';

let expensesData = [];

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentExpenseId = null;

// Elementos
const authSection = document.getElementById('auth-section');
const expensesSection = document.getElementById('expenses-section');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const expensesList = document.getElementById('expenses-list');

function dateToUTC(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString();
}


// ----- AUTENTICACIÓN -----
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        authSection.style.display = 'none';
        expensesSection.style.display = 'block';
        logoutBtn.style.display = 'block';

        userInfo.textContent = user.user_metadata?.full_name
            ? `${user.user_metadata.full_name} (${user.email})`
            : user.email;

        loadExpenses();
    } else {
        authSection.style.display = 'block';
        expensesSection.style.display = 'none';
        logoutBtn.style.display = 'none';
        userInfo.textContent = '';
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else checkAuth();
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Registro exitoso. Revisa tu correo.');
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    checkAuth();
});

// ----- AGREGAR GASTO -----
document.getElementById('add-expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('amount').value);
    const description = document.getElementById('description').value.trim();
    const { data: { user } } = await supabase.auth.getUser();

    const date = document.getElementById('date').value;

    const { error } = await supabase
        .from('expenses')
        .insert({
            user_id: user.id,
            amount,
            description,
            created_at: date ? dateToUTC(date) : new Date().toISOString()
        });


    if (!error) {
        document.getElementById('amount').value = '';
        document.getElementById('description').value = '';
        loadExpenses();
    } else alert(error.message);

    document.getElementById('date').value = '';
});

// ----- CARGAR GASTOS -----
async function loadExpenses() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) return;

    expensesData = data; // <--- Guardar para filtros
    applyFilter('all');  // <--- Mostrar por defecto

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
}

// ----- RENDER GASTOS -----
function renderExpenses(data) {
    expensesList.innerHTML = '';

    if (!data.length) {
        expensesList.innerHTML = `
            <div style="text-align:center;padding:80px 20px;color:#94a3b8;font-size:1.1rem;">
                No hay gastos en este filtro
            </div>`;
        return;
    }

    data.forEach((exp, i) => {
        const div = document.createElement('div');
        div.className = 'expense-item';
        div.style.animationDelay = `${i * 0.06}s`;

        const date = new Date(exp.created_at);
        const formattedDate = date.toLocaleDateString('es-CO', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        }).replace('.', '').replace(/^\w/, c => c.toUpperCase());

        const amount = exp.amount.toLocaleString('es-CO');

        div.innerHTML = `
            <div class="expense-main">
                <div class="expense-description">${exp.description}</div>
                <div class="expense-date">${formattedDate}</div>
            </div>
            <div class="expense-amount">$${amount}</div>
            <div class="expense-actions">
                <button class="edit-btn"
                    data-id="${exp.id}" 
                    data-desc="${exp.description || ''}" 
                    data-amount="${exp.amount}"
                    data-date="${exp.created_at}"
                    Editar
                >
                    Editar
                </button>

                <button type="button" class="delete-btn" data-id="${exp.id}">
                    Eliminar
                </button>
            </div>
        `;
        expensesList.appendChild(div);
    });
}

// ----- FILTROS -----
const filterSelect = document.getElementById('filter-select');

filterSelect.addEventListener('change', () => {
    const type = filterSelect.value;

    document.getElementById('range-inputs').style.display =
        type === 'range' ? 'flex' : 'none';

    if (type !== 'range') applyFilter(type);
});

document.getElementById('apply-range').addEventListener('click', () => {
    const start = new Date(document.getElementById('start-date').value);
    const end = new Date(document.getElementById('end-date').value);

    if (!start || !end) return;

    const filtered = expensesData.filter(exp => {
        const d = new Date(exp.created_at);
        return d >= start && d <= end;
    });

    renderExpenses(filtered);
});

function applyFilter(type) {
    const now = new Date();
    let filtered = expensesData;

    if (type === 'today')
        filtered = expensesData.filter(exp => new Date(exp.created_at).toDateString() === now.toDateString());

    if (type === 'week') {
        const past7 = new Date();
        past7.setDate(now.getDate() - 7);
        filtered = expensesData.filter(exp => new Date(exp.created_at) >= past7);
    }

    if (type === 'month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = expensesData.filter(exp => new Date(exp.created_at) >= monthStart);
    }

    renderExpenses(filtered);
}

// ----- MODALES -----
expensesList.addEventListener('click', (e) => {
    if (e.target.closest('.edit-btn')) {
        const btn = e.target.closest('.edit-btn');
        currentExpenseId = btn.dataset.id;

        document.getElementById('edit-description').value = btn.dataset.desc;
        document.getElementById('edit-amount').value = btn.dataset.amount;

        // Convertir fecha ISO -> yyyy-mm-dd
        const iso = btn.dataset.date;
        if (iso) {
            const d = new Date(iso);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            document.getElementById('edit-date').value = `${yyyy}-${mm}-${dd}`;
        }


        document.getElementById('edit-modal').classList.add('active');
    }

    if (e.target.closest('.delete-btn')) {
        currentExpenseId = e.target.closest('.delete-btn').dataset.id;
        document.getElementById('delete-modal').classList.add('active');
    }
});

document.querySelectorAll('.close-btn, .cancel-btn').forEach(btn => {
    btn.onclick = () => document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.remove('active');
    };
});

// ----- EDITAR -----
document.getElementById('edit-form').onsubmit = async (e) => {
    e.preventDefault();
    const desc = document.getElementById('edit-description').value.trim();
    const amount = parseFloat(document.getElementById('edit-amount').value);

    const newDate = document.getElementById('edit-date').value;

    const { error } = await supabase
        .from('expenses')
        .update({
            description: desc,
            amount,
            created_at: newDate ? dateToUTC(newDate) : undefined
        })
        .eq('id', currentExpenseId);


    if (!error) {
        document.getElementById('edit-modal').classList.remove('active');
        loadExpenses();
    }
};

// ----- ELIMINAR -----
document.getElementById('confirm-delete-btn').onclick = async () => {
    await supabase.from('expenses').delete().eq('id', currentExpenseId);
    document.getElementById('delete-modal').classList.remove('active');
    loadExpenses();
};

// Iniciar app
checkAuth();
