const SUPABASE_URL = 'https://xmlzitpgfkjsmrpfqmex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtbHppdHBnZmtqc21ycGZxbWV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NzYxOTYsImV4cCI6MjA4MDU1MjE5Nn0.kwKihIcDD_9KfXM0IDhdTdKM0s0aDdp5suqMYoEYErM';

let expensesData = [];

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Detectar sesión al cargar la página (especial para Google OAuth)
supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
        console.log("Sesión recuperada (OAuth):", data.session.user);
        checkAuth();
    }
});

// Escuchar cualquier cambio de sesión
supabase.auth.onAuthStateChange((event, session) => {
    console.log("Evento de auth:", event);

    if (session) {
        checkAuth();
    }
});

let currentExpenseId = null;

// VARIABLES GRAFICOS
let chartMonth = null;
let chartCategory = null;
let chartCategoryLines = null;

// VARIABLE PRESUPUESTO
const budgetCard = document.getElementById("budget-card");
const budgetInput = document.getElementById("budget-input");
const saveBudgetBtn = document.getElementById("save-budget");
const budgetProgress = document.getElementById("budget-progress");
const budgetText = document.getElementById("budget-text");
const budgetPercent = document.getElementById("budget-percent");
const budgetExpenses = document.getElementById("budget-expenses");
const editBudgetBtn = document.getElementById("edit-budget-btn");
const deleteBudgetBtn = document.getElementById("delete-budget-btn");

let currentBudget = null;
let currentMonthExpenses = 0;
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1; // 1-12


// Buscador
const searchInput = document.getElementById("search-expense");

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
        loadMonthlyBudget();


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

document.getElementById("google-login").addEventListener("click", async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
});

document.getElementById("google-signup").addEventListener("click", async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
});


// Cambiar a registro
document.getElementById("go-signup").onclick = () => {
    document.getElementById("auth-login").style.display = "none";
    document.getElementById("auth-signup").style.display = "block";
};

// Cambiar a login
document.getElementById("go-login").onclick = () => {
    document.getElementById("auth-login").style.display = "block";
    document.getElementById("auth-signup").style.display = "none";
};


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
    renderMonthlySummary(expensesData);

    // Total mensual
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalMonth = data
        .filter(d => new Date(d.created_at) >= monthStart)
        .reduce((s, d) => s + parseFloat(d.amount), 0);
    
    currentMonthExpenses = totalMonth;

    document.getElementById('monthly-total').textContent =
        '$' + totalMonth.toLocaleString('es-CO', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    

    document.getElementById('summary-card').style.display = 'block';

    renderChartMonths(expensesData);
    renderChartCategories(expensesData);
    renderChartCategoryLines(expensesData);

     // 🔥 Cargar los años y meses AHORA que ya tenemos datos
    loadAvailableYears();
    updateBudgetUI();
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

// ----- GRUPO POR FECHA -----
function renderMonthlySummary(data) {
    const container = document.getElementById('month-summary-list');
    container.innerHTML = '';

    if (!data.length) {
        container.innerHTML = '<p style="color:#94a3b8;">No hay gastos registrados.</p>';
        return;
    }

    // Agrupar por "YYYY-MM"
    const groups = {};

    data.forEach(exp => {
        const d = new Date(exp.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (!groups[key]) groups[key] = 0;
        groups[key] += exp.amount;
    });

    // Ordenar por mes (más reciente primero)
    const ordered = Object.keys(groups).sort((a, b) => new Date(b + "-01") - new Date(a + "-01"));

    ordered.forEach(key => {
        const [year, month] = key.split('-');
        const dateObj = new Date(year, month - 1, 1);

        const monthName = dateObj.toLocaleDateString('es-CO', {
            month: 'long',
            year: 'numeric'
        }).replace(/^\w/, c => c.toUpperCase());

        const total = groups[key].toLocaleString('es-CO');

        const div = document.createElement('div');
        div.classList.add('month-item');

        div.innerHTML = `
            <span class="month-name">${monthName}</span>
            <span class="month-total">$${total}</span>
        `;

        container.appendChild(div);
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
    renderMonthlySummary(filtered);
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

// GRAFICOS}
// ------------------------
// GRAFICO: Gastos por Mes
// ------------------------
function renderChartMonths(data) {
    const grouped = {};

    data.forEach(exp => {
        const d = new Date(exp.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        grouped[key] = (grouped[key] || 0) + exp.amount;
    });

    // Ordenar por fecha
    const keys = Object.keys(grouped).sort();

    // 🔥 Convertir "2025-03" → "Marzo 2025"
    const labels = keys.map(key => {
        const [year, month] = key.split("-");
        const dateObj = new Date(year, month - 1, 1);

        return dateObj.toLocaleDateString("es-CO", {
            month: "long",
            year: "numeric"
        }).replace(/^\w/, c => c.toUpperCase());
    });

    const values = keys.map(key => grouped[key]);

    const ctx = document.getElementById("chart-month").getContext("2d");

    if (chartMonth) chartMonth.destroy();

    chartMonth = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Gasto total",
                data: values,
                borderWidth: 2,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },

                tooltip: {
                    callbacks: {
                        label: (context) =>
                            "$" + context.raw.toLocaleString("es-CO")
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: value =>
                            "$" + value.toLocaleString("es-CO")
                    }
                }
            }
        }
    });
}

// -----------------------------
// GRAFICO: Categorías más usadas
// -----------------------------
function renderChartCategories(data) {
    const grouped = {};

    data.forEach(exp => {
        const category = exp.description || "Sin categoría";
        grouped[category] = (grouped[category] || 0) + exp.amount;
    });

    const labels = Object.keys(grouped);
    const values = labels.map(x => grouped[x]);

    const ctx = document.getElementById("chart-category").getContext("2d");

    if (chartCategory) chartCategory.destroy();

    // 🎨 Generar colores suaves en modo HSL
    const generateColors = (num) => {
        const colors = [];
        for (let i = 0; i < num; i++) {
            const hue = (i * 45) % 360;
            colors.push(`hsl(${hue}, 70%, 60%)`); // color pastel
        }
        return colors;
    };

    const backgroundColors = generateColors(labels.length);
    const borderColors = backgroundColors.map(c => c.replace("60%", "40%")); // un poco más oscuro

    chartCategory = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Gastos por categoría",
                data: values,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },

                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            return "$" + value.toLocaleString("es-CO");
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (value) => "$" + value.toLocaleString("es-CO")
                    }
                }
            }
        }
    });
}

// -----------------------------
// GRAFICO LINEAS: Categorías más usadas
// -----------------------------
function renderChartCategoryLines(data) {
    const grouped = {};

    data.forEach(exp => {
        const d = new Date(exp.created_at);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const category = exp.description || "Sin categoría";

        if (!grouped[monthKey]) grouped[monthKey] = {};
        if (!grouped[monthKey][category]) grouped[monthKey][category] = 0;

        grouped[monthKey][category] += exp.amount;
    });

    const months = Object.keys(grouped).sort();

    // obtener categorías únicas
    const categories = new Set();
    months.forEach(m => {
        Object.keys(grouped[m]).forEach(cat => categories.add(cat));
    });
    const categoriesArray = Array.from(categories);

    // Labels: "Mar 2025"
    const labels = months.map(key => {
        const [year, month] = key.split("-");
        const dateObj = new Date(year, month - 1, 1);
        return dateObj.toLocaleDateString("es-CO", {
            month: "short",
            year: "numeric"
        }).replace(/^\w/, c => c.toUpperCase());
    });

    // una línea por categoría
    const datasets = categoriesArray.map((category, index) => ({
        label: category,
        data: months.map(m => grouped[m][category] || 0),
        borderWidth: 2,
        tension: 0.35,
        fill: false,
    }));

    const ctx = document.getElementById("chart-category-lines").getContext("2d");

    if (chartCategoryLines) chartCategoryLines.destroy();

    chartCategoryLines = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: context =>
                            `${context.dataset.label}: $${context.raw.toLocaleString("es-CO")}`
                    }
                },

                legend: {
                    position: "bottom",
                    labels: {
                        boxWidth: 12
                    }
                }
            },

            scales: {
                y: {
                    ticks: {
                        callback: value => "$" + value.toLocaleString("es-CO")
                    }
                }
            }
        }
    });
}

// Buscador item
searchInput.addEventListener("input", () => {
    const term = searchInput.value.toLowerCase();
    document.querySelectorAll(".expense-item").forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(term) ? "flex" : "none";
    });
});


// Generar lista de años disponibles
function loadAvailableYears() {
    const yearSelect = document.getElementById("report-year");
    const years = new Set();

    expensesData.forEach(exp => {
        const d = new Date(exp.created_at);
        years.add(d.getFullYear());
    });

    const sortedYears = [...years].sort((a, b) => b - a); // de más reciente a más viejo
    yearSelect.innerHTML = "";

    sortedYears.forEach(year => {
        const opt = document.createElement("option");
        opt.value = year;
        opt.textContent = year;
        yearSelect.appendChild(opt);
    });

    // Cargar meses del año seleccionado automáticamente
    loadAvailableMonths(yearSelect.value);
}

// Cargar meses del año elegido
function loadAvailableMonths(selectedYear) {
    const monthSelect = document.getElementById("report-month");
    monthSelect.innerHTML = "";

    const months = new Set();

    expensesData.forEach(exp => {
        const d = new Date(exp.created_at);
        if (d.getFullYear() == selectedYear) {
            months.add(d.getMonth()); // 0–11
        }
    });

    const sortedMonths = [...months].sort((a, b) => a - b);

    sortedMonths.forEach(m => {
        const date = new Date(selectedYear, m, 1);
        const name = date.toLocaleDateString("es-CO", { month: "long" })
                         .replace(/^\w/, c => c.toUpperCase());

        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = name;
        monthSelect.appendChild(opt);
    });

    monthSelect.disabled = sortedMonths.length === 0;
}

document.getElementById("report-year").addEventListener("change", e => {
    loadAvailableMonths(e.target.value);
});

// DESCARGAR REPORTE EN PDF
document.getElementById("download-month-pdf").addEventListener("click", () => {
    const year = document.getElementById("report-year").value;
    const month = document.getElementById("report-month").value;

    if (!year || month === "") {
        alert("Selecciona un año y un mes.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, Number(month) + 1, 1);

    const monthName = monthStart.toLocaleDateString("es-CO", {
        month: "long",
        year: "numeric"
    }).replace(/^\w/, c => c.toUpperCase());

    const monthlyExpenses = expensesData.filter(exp => {
        const d = new Date(exp.created_at);
        return d >= monthStart && d < monthEnd;
    });

    if (monthlyExpenses.length === 0) {
        alert("No hay gastos en ese mes.");
        return;
    }

    const total = monthlyExpenses.reduce((s, x) => s + x.amount, 0);

    // Colores
    const primaryColor = [41, 128, 185];    // Azul
    const accentColor = [52, 152, 219];     // Azul claro
    const textDark = [44, 62, 80];          // Gris oscuro
    const lightGray = [236, 240, 241];      // Gris claro

    // Header con fondo de color
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, 210, 45, 'F');

    // Título en blanco
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('Reporte de Gastos', 105, 20, { align: 'center' });

    pdf.setFontSize(16);
    pdf.setFont(undefined, 'normal');
    pdf.text(monthName, 105, 32, { align: 'center' });

    // Línea decorativa
    pdf.setDrawColor(...accentColor);
    pdf.setLineWidth(1);
    pdf.line(20, 40, 190, 40);

    // Caja de total con fondo
    pdf.setFillColor(...lightGray);
    pdf.roundedRect(20, 50, 170, 20, 3, 3, 'F');

    pdf.setTextColor(...textDark);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('Total del Mes:', 25, 61);

    pdf.setTextColor(...primaryColor);
    pdf.setFontSize(18);
    const totalFormatted = `$${total.toLocaleString("es-CO")}`;
    pdf.text(totalFormatted, 185, 62, { align: 'right' });

    // Sección de detalle
    pdf.setTextColor(...textDark);
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('Detalle de Gastos', 20, 82);

    // Línea bajo el título
    pdf.setDrawColor(...accentColor);
    pdf.setLineWidth(0.5);
    pdf.line(20, 85, 190, 85);

    let y = 95;
    let isEven = false;

    monthlyExpenses.forEach((exp, index) => {
        const date = new Date(exp.created_at).toLocaleDateString("es-CO");
        const amount = `$${exp.amount.toLocaleString("es-CO")}`;

        // Fondo alternado para cada fila
        if (isEven) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(20, y - 6, 170, 10, 'F');
        }

        // Número de ítem
        pdf.setTextColor(...accentColor);
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${index + 1}.`, 22, y);

        // Fecha
        pdf.setTextColor(...textDark);
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.text(date, 30, y);

        // Descripción
        pdf.setFontSize(10);
        const maxWidth = 100;
        const description = exp.description.length > 50 
            ? exp.description.substring(0, 50) + '...' 
            : exp.description;
        pdf.text(description, 60, y);

        // Monto (alineado a la derecha)
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(...primaryColor);
        pdf.text(amount, 185, y, { align: 'right' });

        y += 10;
        isEven = !isEven;

        // Nueva página si es necesario
        if (y > 270) {
            pdf.addPage();
            
            // Repetir header en nueva página
            pdf.setFillColor(...primaryColor);
            pdf.rect(0, 0, 210, 25, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(16);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Reporte de Gastos — ${monthName}`, 105, 16, { align: 'center' });
            
            y = 35;
            isEven = false;
        }
    });

    // Footer en la última página
    const pageCount = pdf.internal.getNumberOfPages();
    pdf.setPage(pageCount);
    
    pdf.setFillColor(...lightGray);
    pdf.rect(0, 280, 210, 17, 'F');
    
    pdf.setTextColor(...textDark);
    pdf.setFontSize(8);
    pdf.setFont(undefined, 'normal');
    const footerText = `Generado el ${new Date().toLocaleDateString("es-CO")} | Total de gastos: ${monthlyExpenses.length}`;
    pdf.text(footerText, 105, 290, { align: 'center' });

    pdf.save(`reporte-${monthName}.pdf`);
});

// TEMA OSCURO/CLARO
document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("theme-toggle");
    const icon = toggleBtn.querySelector(".theme-icon");

    // Load saved theme
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
        document.body.classList.remove("dark");
        icon.textContent = "🌙"; // Moon (para activar modo oscuro)
    } else {
        document.body.classList.add("dark");
        icon.textContent = "☀️"; // Sun (para activar modo claro)
    }

    toggleBtn.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark");

        if (isDark) {
            icon.textContent = "☀️";
            localStorage.setItem("theme", "dark");
        } else {
            icon.textContent = "🌙";
            localStorage.setItem("theme", "light");
        }
    });
});

// PRESUPUESTO MENSUAL
async function loadMonthlyBudget() {
    const { data, error } = await supabase
        .from("monthly_budget")
        .select("amount")
        .eq("year", currentYear)
        .eq("month", currentMonth)
        .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no se encontró fila
        console.error("Error cargando presupuesto:", error);
        return;
    }

    if (data && data.amount > 0) {
        currentBudget = data.amount;
        budgetInput.value = data.amount;
        setBudgetMode("saved");
    } else {
        currentBudget = null;
        budgetInput.value = "";
        setBudgetMode("empty");
    }

    updateBudgetUI();
}

// Botón Editar
editBudgetBtn.addEventListener("click", () => {
    setBudgetMode("editing");
    budgetInput.disabled = false;
    budgetInput.focus();
});

// Botón Guardar / Actualizar
saveBudgetBtn.addEventListener("click", async () => {
    const amountStr = budgetInput.value.trim();
    const amount = Number(amountStr);

    if (!amountStr || amount <= 0) {
        alert("Por favor ingresa un monto válido mayor a cero");
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from("monthly_budget")
        .upsert({
            user_id: user.id,
            year: currentYear,
            month: currentMonth,
            amount: amount
        }, {
            onConflict: "user_id,year,month"
        });

    if (error) {
        console.error("Error guardando presupuesto:", error);
        alert("No se pudo guardar el presupuesto");
        return;
    }

    currentBudget = amount;
    budgetInput.value = amount;
    setBudgetMode("saved");
    updateBudgetUI();
});

// Controla los estados visuales: empty | saved | editing
function setBudgetMode(mode) {
    // Removemos todas las clases de estado
    budgetCard.classList.remove("no-budget", "budget-editing");

    if (mode === "empty") {
        budgetCard.classList.add("no-budget");
        budgetInput.disabled = true;
        saveBudgetBtn.textContent = "Guardar";
    } else if (mode === "saved") {
        budgetInput.disabled = true;
        saveBudgetBtn.textContent = "Actualizar";
    } else if (mode === "editing") {
        budgetCard.classList.add("budget-editing");
        budgetInput.disabled = false;
        saveBudgetBtn.textContent = currentBudget ? "Actualizar" : "Guardar";
    }
}

function updateBudgetUI() {
    if (!currentBudget || currentBudget <= 0) {
        budgetText.innerHTML = "Aún no has definido un presupuesto para este mes";
        budgetExpenses.innerHTML = `
            Gastado este mes:
            <span class="money-pill pill-red">
                $${currentMonthExpenses.toLocaleString("es-CO")}
            </span>`;
        budgetPercent.textContent = "";
        budgetProgress.style.width = "0%";
        document.getElementById("budget-remaining").textContent = "";
        return;
    }

    // Presupuesto definido
    budgetText.innerHTML = `
        Presupuesto del mes:
        <span class="money-pill pill-blue">
            $${currentBudget.toLocaleString("es-CO")}
        </span>`;

    budgetExpenses.innerHTML = `
        Gastado este mes:
        <span class="money-pill pill-red">
            $${currentMonthExpenses.toLocaleString("es-CO")}
        </span>`;

    const percent = Math.min((currentMonthExpenses / currentBudget) * 100, 100);
    const percentText = percent.toFixed(0);

    budgetPercent.innerHTML = `<strong>${percentText}%</strong> usado`;

    budgetProgress.style.width = percent + "%";

    // Colores dinámicos de la barra
    budgetProgress.classList.remove("low", "medium", "high");
    if (percent < 60) {
        budgetProgress.classList.add("low");
    } else if (percent < 85) {
        budgetProgress.classList.add("medium");
    } else {
        budgetProgress.classList.add("high");
    }

    // ================= NUEVO: CÁLCULO DEL RESTANTE =================
    const remaining = currentBudget - currentMonthExpenses;
    const remainingEl = document.getElementById("budget-remaining");

    if (remaining > 0) {
        remainingEl.textContent = `Te sobran $${remaining.toLocaleString("es-CO")} 💰`;
        remainingEl.className = "budget-remaining positive";
    } else if (remaining < 0) {
        const over = Math.abs(remaining);
        remainingEl.textContent = `Te pasaste por $${over.toLocaleString("es-CO")} ⚠️`;
        remainingEl.className = "budget-remaining negative";
    } else {
        remainingEl.textContent = "Exacto al presupuesto 👌";
        remainingEl.className = "budget-remaining neutral";
    }
}

// ELIMINAR PRESUPUESTO
deleteBudgetBtn.addEventListener("click", async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar el presupuesto de este mes?")) {
        return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from("monthly_budget")
        .delete()
        .eq("user_id", user.id)
        .eq("year", currentYear)
        .eq("month", currentMonth);

    if (error) {
        console.error("Error eliminando presupuesto:", error);
        alert("No se pudo eliminar el presupuesto");
        return;
    }

    currentBudget = null;
    budgetInput.value = "";
    setBudgetMode("empty");
    updateBudgetUI();
});


checkAuth();
