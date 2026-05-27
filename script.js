// 1. IMPORTAÇÕES DO FIREBASE VIA CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 2. CONFIGURAÇÃO OFICIAL DO SEU PROJETO
const firebaseConfig = {
  apiKey: "AIzaSyD0zhL_e3cyID6AoZ5czsisKQw0aCoi0XQ",
  authDomain: "almoxarifado-606ec.firebaseapp.com",
  projectId: "almoxarifado-606ec",
  storageBucket: "almoxarifado-606ec.firebasestorage.app",
  messagingSenderId: "475873277697",
  appId: "1:475873277697:web:6322bbf8cb2b0124160d00"
};

// 3. INICIALIZAÇÃO DO FIREBASE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- INICIALIZAÇÃO DO SISTEMA ---
async function init() {
    // Verifica se já existem usuários cadastrados na nuvem, se não, cria o admin mestre
    const querySnapshot = await getDocs(collection(db, "users"));
    if (querySnapshot.empty) {
        await addDoc(collection(db, "users"), { user: 'adm1', pass: '123', level: 'ADM' });
    }

    // Renderiza o select de prateleiras no formulário de cadastro
    const select = document.getElementById('p-shelf');
    if (select) {
        select.innerHTML = ''; 
        for (let i = 1; i <= 13; i++) {
            const opt = document.createElement('option');
            const num = i.toString().padStart(2, '0');
            opt.value = i; 
            opt.textContent = `Prateleira ${num}`;
            select.appendChild(opt);
        }
    }

    setupNavigation();
    
    // Verifica se já existe login ativo na sessão atual para pular a tela de login
    const loggedUserRaw = sessionStorage.getItem('logged_user');
    if (loggedUserRaw) {
        enterApp(JSON.parse(loggedUserRaw));
    }
}

// --- NAVEGAÇÃO ---
function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.main-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.dataset.target;
            
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            document.getElementById('current-page-title').textContent = item.innerText;
        });
    });
}

// --- TELA DE LOGIN ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const uInput = document.getElementById('login-user').value;
    const pInput = document.getElementById('login-pass').value;

    // Busca os usuários direto do Firebase
    const querySnapshot = await getDocs(collection(db, "users"));
    let found = null;
    
    querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.user === uInput && userData.pass === pInput) {
            found = userData;
        }
    });

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

// --- AUXILIARES ---
function getStatus(qty, red, yellow) {
    qty = Number(qty); red = Number(red); yellow = Number(yellow);
    if (qty <= red) return { label: 'CRÍTICO', class: 'pill-red' };
    if (qty <= yellow) return { label: 'ATENÇÃO', class: 'pill-yellow' };
    return { label: 'SAUDÁVEL', class: 'pill-green' };
}

// --- MOVIMENTAÇÃO DE ESTOQUE (ENTRADA / SAÍDA) ---
async function moveStock(id, type) {
    // Busca a lista atualizada de produtos da nuvem
    const querySnapshot = await getDocs(collection(db, "products"));
    let prod = null;
    
    querySnapshot.forEach((docSnapshot) => {
        if (docSnapshot.id === id) {
            prod = { id: docSnapshot.id, ...docSnapshot.data() };
        }
    });

    if (!prod) return; 

    const actionName = type === 'OUT' ? 'RETIRAR' : 'DEVOLVER';
    let qtdStr = prompt(`Quantas unidades de "${prod.name}" você deseja ${actionName}?`);
    if (!qtdStr) return; 

    let qtd = parseInt(qtdStr);
    if (isNaN(qtd) || qtd <= 0) {
        alert('Quantidade inválida! Digite um número maior que zero.');
        return;
    }

    if (type === 'OUT' && qtd > prod.qty) {
        alert(`Estoque insuficiente! Você tentou retirar ${qtd}, mas só existem ${prod.qty} disponíveis.`);
        return;
    }

    // Calcula nova quantidade
    const novaQtd = type === 'OUT' ? Number(prod.qty) - qtd : Number(prod.qty) + qtd;

    // 1. Atualiza a quantidade do produto na Nuvem
    const prodRef = doc(db, "products", id);
    await updateDoc(prodRef, { qty: novaQtd });

    // 2. Registra a movimentação no histórico global na Nuvem
    const loggedUserRaw = sessionStorage.getItem('logged_user');
    const currentUser = loggedUserRaw ? JSON.parse(loggedUserRaw).user : 'Desconhecido';
    
    await addDoc(collection(db, "history"), {
        timestamp: Date.now(), // Usado para ordenar cronologicamente
        date: new Date().toLocaleString('pt-BR'),
        user: currentUser,
        type: type,
        prod: prod.name,
        qty: qtd
    });

    renderAll();
}

// --- RENDERIZAÇÃO CENTRALIZADA (ASSÍNCRONA) ---
async function renderAll() {
    // Carrega dados em tempo real da nuvem
    const prodSnapshot = await getDocs(collection(db, "products"));
    const prods = [];
    prodSnapshot.forEach(doc => {
        prods.push({ id: doc.id, ...doc.data() });
    });

    const search = document.getElementById('global-search').value.toLowerCase();
    const currentUser = JSON.parse(sessionStorage.getItem('logged_user'));
    const isAdm = currentUser?.level === 'ADM';
    
    const filtered = prods.filter(p => 
        p.name.toLowerCase().includes(search) || 
        p.code.toLowerCase().includes(search) ||
        p.brand.toLowerCase().includes(search)
    );

    let redCount = 0, yellowCount = 0, greenCount = 0;
    const urgentTbody = document.getElementById('urgent-tbody');
    const inventoryTbody = document.getElementById('inventory-tbody');
    
    if (urgentTbody) urgentTbody.innerHTML = '';
    if (inventoryTbody) inventoryTbody.innerHTML = '';

    filtered.forEach(p => {
        const stat = getStatus(p.qty, p.lred, p.lyellow);
        
        if (stat.label === 'CRÍTICO') redCount++;
        else if (stat.label === 'ATENÇÃO') yellowCount++;
        else greenCount++;

        const pShelfStr = String(p.shelf || '1').padStart(2, '0');

        // TABELA ESTOQUE CRÍTICO: Adicionado data-label
        const urgentRow = `
            <tr>
                <td data-label="Produto"><strong>${p.name}</strong></td>
                <td data-label="Marca">${p.brand}</td>
                <td data-label="Cód. Protheus"><code>${p.code}</code></td>
                <td data-label="Prateleira">P${pShelfStr}</td>
                <td data-label="QTD"><strong style="color:${Number(p.qty) <= Number(p.lred) ? 'var(--red)' : 'inherit'}">${p.qty}</strong></td>
                <td data-label="Status"><span class="status-pill ${stat.class}">${stat.label}</span></td>
            </tr>
        `;

        const btnDelete = isAdm ? `<button title="Excluir Produto" style="color:var(--red); background:none; border:none; cursor:pointer;" onclick="deleteProd('${p.id}')"><i class="fa-solid fa-trash"></i></button>` : '';
        const actionButtons = `
            <div style="display:flex; gap:8px;">
                <button class="btn-action btn-out" onclick="moveStock('${p.id}', 'OUT')" title="Retirar Item"><i class="fa-solid fa-minus"></i></button>
                <button class="btn-action btn-in" onclick="moveStock('${p.id}', 'IN')" title="Devolver Item"><i class="fa-solid fa-plus"></i></button>
                ${btnDelete}
            </div>
        `;

        // TABELA LISTA DE PRODUTOS: Adicionado data-label
        if (inventoryTbody) {
            inventoryTbody.innerHTML += `
                <tr>
                    <td data-label="Nome"><strong>${p.name}</strong></td>
                    <td data-label="Especificação">${p.spec}</td>
                    <td data-label="Marca">${p.brand}</td>
                    <td data-label="Cód."><code>${p.code}</code></td>
                    <td data-label="Prat.">P${pShelfStr}</td>
                    <td data-label="QTD"><span class="status-pill ${stat.class}">${p.qty}</span></td>
                    <td data-label="Vermelho">${p.lred}</td>
                    <td data-label="Amarelo">${p.lyellow}</td>
                    <td data-label="Ações">${actionButtons}</td>
                </tr>
            `;
        }

        if (stat.label === 'CRÍTICO' && urgentTbody) {
            urgentTbody.innerHTML += urgentRow;
        }
    });

    if(document.getElementById('kpi-total')) document.getElementById('kpi-total').textContent = prods.length;
    if(document.getElementById('kpi-red')) document.getElementById('kpi-red').textContent = redCount;
    if(document.getElementById('kpi-yellow')) document.getElementById('kpi-yellow').textContent = yellowCount;
    if(document.getElementById('kpi-green')) document.getElementById('kpi-green').textContent = greenCount;

    // --- CORREÇÃO AQUI ---
    // Passando a lista filtrada ('filtered') ao invés da lista bruta global ('prods')
    renderShelves(filtered); 
    
    renderUsers();
    renderHistory();
}

// --- HISTÓRICO DE MOVIMENTAÇÕES ---
async function renderHistory() {
    // Puxa o histórico ordenado pelo registro mais recente
    const historyQuery = query(collection(db, "history"), orderBy("timestamp", "desc"));
    const historySnapshot = await getDocs(historyQuery);
    
    const history = [];
    historySnapshot.forEach(doc => {
        history.push({ id: doc.id, ...doc.data() });
    });

    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    
    const searchTxt = document.getElementById('hist-search')?.value.toLowerCase() || '';
    const userFilter = document.getElementById('hist-user-filter')?.value || '';
    const prodFilter = document.getElementById('hist-prod-filter')?.value.toLowerCase() || '';

    // Popula o dropdown dinâmico de usuários se estiver vazio
    const userSelect = document.getElementById('hist-user-filter');
    if (userSelect && userSelect.options.length <= 1 && history.length > 0) {
        const uniqueUsers = [...new Set(history.map(h => h.user))];
        uniqueUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            opt.textContent = u;
            userSelect.appendChild(opt);
        });
    }

    const filteredHistory = history.filter(h => {
        const matchSearch = h.prod.toLowerCase().includes(searchTxt) || 
                            h.user.toLowerCase().includes(searchTxt) || 
                            h.date.includes(searchTxt);
                            
        const matchUser = userFilter === '' || h.user === userFilter;
        const matchProd = prodFilter === '' || h.prod.toLowerCase().includes(prodFilter);

        return matchSearch && matchUser && matchProd;
    });

    tbody.innerHTML = '';
    
    if (filteredHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-dim);">Nenhuma movimentação encontrada.</td></tr>`;
        return;
    }
    
    filteredHistory.forEach(h => {
        const badge = h.type === 'OUT' 
            ? '<span class="status-pill pill-yellow">RETIRADA</span>' 
            : '<span class="status-pill pill-blue" style="background:rgba(59,130,246,0.2); color:var(--accent);">DEVOLUÇÃO</span>';
            
        // TABELA HISTÓRICO: Adicionado data-label
        tbody.innerHTML += `
            <tr>
                <td data-label="Data / Hora">${h.date}</td>
                <td data-label="Usuário"><strong>${h.user}</strong></td>
                <td data-label="Ação">${badge}</td>
                <td data-label="Produto">${h.prod}</td>
                <td data-label="QTD"><strong>${h.qty}</strong></td>
            </tr>
        `;
    });
}

// --- MONITORAMENTO DE FILTROS DO HISTÓRICO ---
document.getElementById('hist-search')?.addEventListener('input', renderHistory);
document.getElementById('hist-user-filter')?.addEventListener('change', renderHistory);
document.getElementById('hist-prod-filter')?.addEventListener('input', renderHistory);

// --- VISUALIZAÇÃO DO ALMOXARIFADO (ESTRUTURA DAS PRATELEIRAS) ---
function renderShelves(prods) {
    const container = document.getElementById('shelves-container');
    if (!container) return;

    const openShelves = Array.from(container.children)
        .filter(card => card.classList.contains('active'))
        .map(card => card.querySelector('.shelf-id').textContent.trim());

    container.innerHTML = '';

    // --- MELHORIA DE UX ---
    // Pega o termo digitado no campo de pesquisa global para ocultar caixas vazias
    const currentSearch = document.getElementById('global-search')?.value.trim() || '';

    for (let i = 1; i <= 13; i++) {
        const shelfProds = prods.filter(p => Number(p.shelf) === i);
        
        // Se houver uma pesquisa ativa e esta prateleira não possuir o item, ela não será gerada na tela
        if (shelfProds.length === 0 && currentSearch !== '') {
            continue;
        }

        const shelfNum = i.toString().padStart(2, '0');
        const isActive = openShelves.includes(shelfNum) ? 'active' : '';

        const card = document.createElement('div');
        card.className = `shelf-card ${isActive}`;
        card.innerHTML = `
            <div class="shelf-top" onclick="this.parentElement.classList.toggle('active')">
                <div class="shelf-id">${shelfNum}</div>
                <div class="shelf-info">
                    <h4>Prateleira ${shelfNum}</h4>
                    <p>${shelfProds.length} itens cadastrados</p>
                </div>
                <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="shelf-details" style="padding-top: 10px;">
                ${shelfProds.length > 0 ? 
                    shelfProds.map(p => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span>• <strong>${p.name}</strong> (${p.qty} un)</span>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-action btn-out" style="width: 26px; height: 26px; font-size: 11px;" onclick="moveStock('${p.id}', 'OUT')" title="Retirar do estoque"><i class="fa-solid fa-minus"></i></button>
                                <button class="btn-action btn-in" style="width: 26px; height: 26px; font-size: 11px;" onclick="moveStock('${p.id}', 'IN')" title="Devolver ao estoque"><i class="fa-solid fa-plus"></i></button>
                            </div>
                        </div>
                    `).join('') 
                    : '<p style="color:var(--text-dim); font-size:12px;">Vazia</p>'}
            </div>
        `;
        container.appendChild(card);
    }
}

// --- CADASTRO DE NOVO PRODUTO ---
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novoProduto = {
        name: document.getElementById('p-name').value,
        spec: document.getElementById('p-spec').value,
        brand: document.getElementById('p-brand').value,
        code: document.getElementById('p-code').value,
        shelf: document.getElementById('p-shelf').value,
        qty: Number(document.getElementById('p-qty').value),
        lred: Number(document.getElementById('p-lred').value),
        lyellow: Number(document.getElementById('p-lyellow').value)
    };

    // Adiciona o produto na coleção do Firebase
    await addDoc(collection(db, "products"), novoProduto);
    
    e.target.reset();
    renderAll();
    alert('Produto salvo com sucesso na nuvem!');
});

// --- REMOÇÃO DE PRODUTO ---
async function deleteProd(id) {
    if (!confirm('Tem certeza que deseja excluir este produto do sistema definitivamente?')) return;
    
    const prodRef = doc(db, "products", id);
    await deleteDoc(prodRef);
    
    renderAll();
}

// --- GERENCIAMENTO DE USUÁRIOS ---
async function renderUsers() {
    const querySnapshot = await getDocs(collection(db, "users"));
    const tbody = document.getElementById('user-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    querySnapshot.forEach((docSnapshot) => {
        const u = docSnapshot.data();
        const id = docSnapshot.id;
        
        // TABELA USUÁRIOS: Adicionado data-label
        tbody.innerHTML += `
            <tr>
                <td data-label="Usuário">${u.user} ${u.user === 'adm1' ? '<small>(mestre)</small>' : ''}</td>
                <td data-label="Nível"><span class="status-pill ${u.level === 'ADM' ? 'pill-green' : 'pill-yellow'}">${u.level}</span></td>
                <td data-label="Ações">${u.user === 'adm1' ? 'protegido' : `<button style="background:none; border:none; color:var(--red); cursor:pointer;" onclick="deleteUser('${id}')"><i class="fa-solid fa-trash"></i></button>`}</td>
            </tr>
        `;
    });
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const novoUsuario = {
        user: document.getElementById('u-name').value,
        pass: document.getElementById('u-pass').value,
        level: document.getElementById('u-level').value
    };

    await addDoc(collection(db, "users"), novoUsuario);
    
    e.target.reset();
    renderUsers();
});

async function deleteUser(id) {
    if (!confirm(`Remover acesso deste usuário do banco de dados?`)) return;
    
    const userRef = doc(db, "users", id);
    await deleteDoc(userRef);
    
    renderUsers();
}

// Ouvinte do campo de busca global da barra superior
document.getElementById('global-search').addEventListener('input', renderAll);

// --- MAPEAMENTO GLOBAL PARA ACESSO DO NAVAGADOR (AÇÕES DO HTML) ---
window.moveStock = moveStock;
window.deleteProd = deleteProd;
window.deleteUser = deleteUser;

// Dispara a inicialização geral
init();