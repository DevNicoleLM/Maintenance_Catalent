// --- DATABASE MOCK (Local Storage) ---
const storage = {
    get: (key) => JSON.parse(localStorage.getItem(key)) || [],
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

const DB_PROD = 'catalent_prods';
const DB_USER = 'catalent_users';

// --- INICIALIZAÇÃO ---
function init() {
    // Usuário Mestre
    const users = storage.get(DB_USER);
    if (users.length === 0) {
        users.push({ user: 'adm1', pass: '123', level: 'ADM' });
        storage.set(DB_USER, users);
    }

    // Popular Select de Prateleiras
    const select = document.getElementById('p-shelf');
    for (let i = 1; i <= 12; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = `Prateleira ${i.toString().padStart(2, '0')}`;
        select.appendChild(opt);
    }

    setupNavigation();
    renderAll();
}

// --- NAVEGAÇÃO ---
function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.main-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.target;
            
            // Trocar classe ativa no menu
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Trocar seção visível
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            // Mudar título do header
            document.getElementById('current-page-title').textContent = item.innerText;
        });
    });
}

// --- LOGIN ---
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const uInput = document.getElementById('login-user').value;
    const pInput = document.getElementById('login-pass').value;

    const users = storage.get(DB_USER);
    const found = users.find(u => u.user === uInput && u.pass === pInput);

    if (found) {
        sessionStorage.setItem('logged_user', JSON.stringify(found));
        enterApp(found);
    } else {
        alert('Credenciais incorretas!');
    }
});

function enterApp(user) {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app-container').style.display = 'grid';
    
    document.getElementById('logged-username').textContent = user.user;
    document.getElementById('logged-userlevel').textContent = user.level;

    if (user.level === 'ADM') {
        document.body.classList.add('is-adm');
    }

    renderAll();
}

document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.clear();
    location.reload();
});

// --- LÓGICA DE PRODUTOS ---
function getStatus(qty, red, yellow) {
    qty = Number(qty); red = Number(red); yellow = Number(yellow);
    if (qty <= red) return { label: 'CRÍTICO', class: 'pill-red' };
    if (qty <= yellow) return { label: 'ATENÇÃO', class: 'pill-yellow' };
    return { label: 'SAUDÁVEL', class: 'pill-green' };
}

function renderAll() {
    const prods = storage.get(DB_PROD);
    const search = document.getElementById('global-search').value.toLowerCase();
    
    const filtered = prods.filter(p => 
        p.name.toLowerCase().includes(search) || 
        p.code.toLowerCase().includes(search) ||
        p.brand.toLowerCase().includes(search)
    );

    // Render KPIs
    let redCount = 0, yellowCount = 0, greenCount = 0;
    const urgentTbody = document.getElementById('urgent-tbody');
    const inventoryTbody = document.getElementById('inventory-tbody');
    
    urgentTbody.innerHTML = '';
    inventoryTbody.innerHTML = '';

    filtered.forEach(p => {
        const stat = getStatus(p.qty, p.lred, p.lyellow);
        
        if (stat.label === 'CRÍTICO') redCount++;
        else if (stat.label === 'ATENÇÃO') yellowCount++;
        else greenCount++;

        const row = `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.spec}</td>
                <td>${p.brand}</td>
                <td><code>${p.code}</code></td>
                <td>P${p.shelf.padStart(2, '0')}</td>
                <td><strong style="color:${p.qty <= p.lred ? 'var(--red)' : 'inherit'}">${p.qty}</strong></td>
                ${p.id ? `<td>${p.lred}</td><td>${p.lyellow}</td><td><button onclick="deleteProd(${p.id})">Excluir</button></td>` : ''}
                <td><span class="status-pill ${stat.class}">${stat.label}</span></td>
            </tr>
        `;

        inventoryTbody.innerHTML += `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.spec}</td>
                <td>${p.brand}</td>
                <td><code>${p.code}</code></td>
                <td>P${p.shelf.padStart(2, '0')}</td>
                <td><span class="status-pill ${stat.class}">${p.qty}</span></td>
                <td>${p.lred}</td>
                <td>${p.lyellow}</td>
                <td><button style="color:var(--red); background:none; border:none; cursor:pointer;" onclick="deleteProd(${p.id})"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `;

        if (stat.label === 'CRÍTICO') urgentTbody.innerHTML += row;
    });

    document.getElementById('kpi-total').textContent = prods.length;
    document.getElementById('kpi-red').textContent = redCount;
    document.getElementById('kpi-yellow').textContent = yellowCount;
    document.getElementById('kpi-green').textContent = greenCount;

    renderShelves(prods);
    renderUsers();
}

// --- ALMOXARIFADO ---
function renderShelves(prods) {
    const container = document.getElementById('shelves-container');
    container.innerHTML = '';

    for (let i = 1; i <= 12; i++) {
        const shelfProds = prods.filter(p => Number(p.shelf) === i);
        const card = document.createElement('div');
        card.className = 'shelf-card';
        card.innerHTML = `
            <div class="shelf-top" onclick="this.parentElement.classList.toggle('active')">
                <div class="shelf-id">${i.toString().padStart(2, '0')}</div>
                <div class="shelf-info">
                    <h4>Prateleira ${i.toString().padStart(2, '0')}</h4>
                    <p>${shelfProds.length} itens cadastrados</p>
                </div>
                <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="shelf-details">
                ${shelfProds.length > 0 ? 
                    shelfProds.map(p => `<div style="margin-bottom:5px; font-size:12px;">• ${p.name} (${p.qty} un)</div>`).join('') 
                    : '<p style="color:var(--text-dim); font-size:12px;">Vazia</p>'}
            </div>
        `;
        container.appendChild(card);
    }
}

// --- FORMULÁRIOS ---
document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const prods = storage.get(DB_PROD);
    prods.push({
        id: Date.now(),
        name: document.getElementById('p-name').value,
        spec: document.getElementById('p-spec').value,
        brand: document.getElementById('p-brand').value,
        code: document.getElementById('p-code').value,
        shelf: document.getElementById('p-shelf').value,
        qty: document.getElementById('p-qty').value,
        lred: document.getElementById('p-lred').value,
        lyellow: document.getElementById('p-lyellow').value
    });
    storage.set(DB_PROD, prods);
    e.target.reset();
    renderAll();
    alert('Produto salvo!');
});

function deleteProd(id) {
    if(!confirm('Excluir este item?')) return;
    let prods = storage.get(DB_PROD);
    prods = prods.filter(p => p.id !== id);
    storage.set(DB_PROD, prods);
    renderAll();
}

// --- USUÁRIOS ---
function renderUsers() {
    const users = storage.get(DB_USER);
    const tbody = document.getElementById('user-tbody');
    tbody.innerHTML = '';
    users.forEach(u => {
        tbody.innerHTML += `
            <tr>
                <td>${u.user} ${u.user === 'adm1' ? '<small>(mestre)</small>' : ''}</td>
                <td><span class="status-pill ${u.level === 'ADM' ? 'pill-green' : 'pill-yellow'}">${u.level}</span></td>
                <td>${u.user === 'adm1' ? 'protegido' : `<button onclick="deleteUser('${u.user}')">Remover</button>`}</td>
            </tr>
        `;
    });
}

document.getElementById('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const users = storage.get(DB_USER);
    users.push({
        user: document.getElementById('u-name').value,
        pass: document.getElementById('u-pass').value,
        level: document.getElementById('u-level').value
    });
    storage.set(DB_USER, users);
    e.target.reset();
    renderUsers();
});

function deleteUser(name) {
    let users = storage.get(DB_USER);
    users = users.filter(u => u.user !== name);
    storage.set(DB_USER, users);
    renderUsers();
}

document.getElementById('global-search').addEventListener('input', renderAll);
//commit
init();