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
    orderBy,
    onSnapshot 
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

// Guardar prateleiras dinâmicas ativas
let currentDynamicShelves = [];

// --- INICIALIZAÇÃO DO SISTEMA ---
async function init() {
    const querySnapshot = await getDocs(collection(db, "users"));
    if (querySnapshot.empty) {
        await addDoc(collection(db, "users"), { user: 'adm1', pass: '123', level: 'ADM' });
    }

    setupNavigation();
    
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
            if(!target) return;
            
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            document.getElementById('current-page-title').textContent = item.innerText;
        });
    });
}

window.switchTab = function(tabId, btnElement) {
    const sections = document.querySelectorAll('.main-section');
    const menuItems = document.querySelectorAll('.menu-item');

    menuItems.forEach(i => i.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    sections.forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById(tabId);
    if (targetSection) targetSection.classList.add('active');

    const titleElement = document.getElementById('current-page-title');
    if (titleElement && btnElement) titleElement.textContent = btnElement.innerText.trim();
};

// --- TELA DE LOGIN ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uInput = document.getElementById('login-user').value;
    const pInput = document.getElementById('login-pass').value;

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

document.getElementById('btn-logout')?.addEventListener('click', () => {
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

// --- MOVIMENTAÇÃO DE ESTOQUE ---
async function moveStock(id, type) {
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
        alert('Quantidade inválida!');
        return;
    }

    if (type === 'OUT' && qtd > prod.qty) {
        alert(`Estoque insuficiente! Disponível: ${prod.qty}`);
        return;
    }

    const novaQtd = type === 'OUT' ? Number(prod.qty) - qtd : Number(prod.qty) + qtd;

    const prodRef = doc(db, "products", id);
    await updateDoc(prodRef, { qty: novaQtd });

    const loggedUserRaw = sessionStorage.getItem('logged_user');
    const currentUser = loggedUserRaw ? JSON.parse(loggedUserRaw).user : 'Desconhecido';
    
    await addDoc(collection(db, "history"), {
        timestamp: Date.now(),
        date: new Date().toLocaleString('pt-BR'),
        user: currentUser,
        type: type,
        prod: prod.name,
        qty: qtd
    });

    renderAll();
}

// --- RENDERIZAÇÃO CENTRALIZADA ---
async function renderAll() {
    const prodSnapshot = await getDocs(collection(db, "products"));
    const prods = [];
    prodSnapshot.forEach(doc => {
        prods.push({ id: doc.id, ...doc.data() });
    });

    const search = document.getElementById('global-search')?.value.toLowerCase() || '';
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

        // Descobre o nome visual da prateleira (Fixa ou Dinâmica)
        const dynShelf = currentDynamicShelves.find(s => s.id === p.shelf);
        const pShelfStr = dynShelf ? dynShelf.name : (!isNaN(Number(p.shelf)) ? `P${String(p.shelf).padStart(2, '0')}` : p.shelf);

        const urgentRow = `
            <tr>
                <td data-label="Produto"><strong>${p.name}</strong></td>
                <td data-label="Marca">${p.brand}</td>
                <td data-label="Cód. Protheus"><code>${p.code}</code></td>
                <td data-label="Prateleira">${pShelfStr}</td>
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

        if (inventoryTbody) {
            inventoryTbody.innerHTML += `
                <tr>
                    <td data-label="Nome"><strong>${p.name}</strong></td>
                    <td data-label="Especificação">${p.spec}</td>
                    <td data-label="Marca">${p.brand}</td>
                    <td data-label="Cód."><code>${p.code}</code></td>
                    <td data-label="Prat.">${pShelfStr}</td>
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

    renderShelves(filtered); 
    renderUsers();
    renderHistory();
}

// --- HISTÓRICO DE MOVIMENTAÇÕES ---
async function renderHistory() {
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

document.getElementById('hist-search')?.addEventListener('input', renderHistory);
document.getElementById('hist-user-filter')?.addEventListener('change', renderHistory);
document.getElementById('hist-prod-filter')?.addEventListener('input', renderHistory);

// --- PRATELEIRAS FIXAS E DINÂMICAS ---
function renderShelves(prods) {
    const container = document.getElementById('shelves-container');
    if (!container) return;

    let staticContainer = document.getElementById('static-shelves-list');
    if (!staticContainer) {
        staticContainer = document.createElement('div');
        staticContainer.id = 'static-shelves-list';
        staticContainer.style.width = '100%';
        container.insertBefore(staticContainer, container.firstChild);
    }

    staticContainer.innerHTML = '';
    const currentSearch = document.getElementById('global-search')?.value.trim() || '';

    // 1. Renderiza as 14 Fixas
    for (let i = 1; i <= 14; i++) {
        const shelfProds = prods.filter(p => Number(p.shelf) === i);
        if (shelfProds.length === 0 && currentSearch !== '') continue;

        const shelfNum = i.toString().padStart(2, '0');

        const card = document.createElement('div');
        card.className = `shelf-card`;
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
                                <button class="btn-action btn-out" style="width: 26px; height: 26px; font-size: 11px;" onclick="moveStock('${p.id}', 'OUT')"><i class="fa-solid fa-minus"></i></button>
                                <button class="btn-action btn-in" style="width: 26px; height: 26px; font-size: 11px;" onclick="moveStock('${p.id}', 'IN')"><i class="fa-solid fa-plus"></i></button>
                            </div>
                        </div>
                    `).join('') 
                    : '<p style="color:var(--text-dim); font-size:12px;">Vazia</p>'}
            </div>
        `;
        staticContainer.appendChild(card);
    }

    // 2. Renderiza as Dinâmicas com os Produtos dentro delas!
    let dynamicContainer = document.getElementById('dynamic-shelves-list');
    if (!dynamicContainer) {
        dynamicContainer = document.createElement('div');
        dynamicContainer.id = 'dynamic-shelves-list';
        dynamicContainer.style.width = '100%';
        container.appendChild(dynamicContainer);
    }

    dynamicContainer.innerHTML = '';
    currentDynamicShelves.forEach(shelf => {
        const shelfProds = prods.filter(p => p.shelf === shelf.id || p.shelf === shelf.name);
        if (shelfProds.length === 0 && currentSearch !== '') return;

        const card = document.createElement('div');
        card.className = `shelf-card`;
        card.innerHTML = `
            <div class="shelf-top" onclick="this.parentElement.classList.toggle('active')">
                <div class="shelf-id"><i class="fas fa-box"></i></div>
                <div class="shelf-info">
                    <h4>${shelf.name}</h4>
                    <p>${shelfProds.length} itens cadastrados</p>
                </div>
                <button class="btn-action pill-red adm-only" style="width: auto; padding: 5px 10px; font-size: 12px;" onclick="event.stopPropagation(); deleteShelf('${shelf.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="shelf-details" style="padding-top: 10px;">
                ${shelfProds.length > 0 ? 
                    shelfProds.map(p => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <span>• <strong>${p.name}</strong> (${p.qty} un)</span>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-action btn-out" style="width: 26px; height: 26px; font-size: 11px;" onclick="moveStock('${p.id}', 'OUT')"><i class="fa-solid fa-minus"></i></button>
                                <button class="btn-action btn-in" style="width: 26px; height: 26px; font-size: 11px;" onclick="moveStock('${p.id}', 'IN')"><i class="fa-solid fa-plus"></i></button>
                            </div>
                        </div>
                    `).join('') 
                    : '<p style="color:var(--text-dim); font-size:12px;">Vazia</p>'}
            </div>
        `;
        dynamicContainer.appendChild(card);
    });
}

// --- CADASTRO DE PRODUTO ---
document.getElementById('product-form')?.addEventListener('submit', async (e) => {
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

    await addDoc(collection(db, "products"), novoProduto);
    e.target.reset();
    renderAll();
    alert('Produto salvo com sucesso!');
});

async function deleteProd(id) {
    if (!confirm('Deseja excluir este produto definitivamente?')) return;
    await deleteDoc(doc(db, "products", id));
    renderAll();
}

// --- USUÁRIOS ---
async function renderUsers() {
    const querySnapshot = await getDocs(collection(db, "users"));
    const tbody = document.getElementById('user-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    querySnapshot.forEach((docSnapshot) => {
        const u = docSnapshot.data();
        const id = docSnapshot.id;
        
        tbody.innerHTML += `
            <tr>
                <td data-label="Usuário">${u.user} ${u.user === 'adm1' ? '<small>(mestre)</small>' : ''}</td>
                <td data-label="Nível"><span class="status-pill ${u.level === 'ADM' ? 'pill-green' : 'pill-yellow'}">${u.level}</span></td>
                <td data-label="Ações">${u.user === 'adm1' ? 'protegido' : `<button style="background:none; border:none; color:var(--red); cursor:pointer;" onclick="deleteUser('${id}')"><i class="fa-solid fa-trash"></i></button>`}</td>
            </tr>
        `;
    });
}

document.getElementById('user-form')?.addEventListener('submit', async (e) => {
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
    if (!confirm(`Remover acesso deste usuário?`)) return;
    await deleteDoc(doc(db, "users", id));
    renderUsers();
}

document.getElementById('global-search')?.addEventListener('input', renderAll);

// Exposição global de funções
window.moveStock = moveStock;
window.deleteProd = deleteProd;
window.deleteUser = deleteUser;

// ==========================================
// MÁQUINAS -> ITENS -> SUBITENS (FIREBASE)
// ==========================================
const machinesCol = collection(db, "machines");
const machineItemsCol = collection(db, "machine_items");
const machineSubitemsCol = collection(db, "machine_subitems");

const formMachine = document.getElementById('form-machine') || document.getElementById('machine-form');
if (formMachine) {
    formMachine.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('m-name') || document.getElementById('machine-name');
        const codeInput = document.getElementById('m-code') || document.getElementById('machine-code');

        if (!nameInput || !nameInput.value.trim()) {
            alert("Digite o nome da máquina!");
            return;
        }

        try {
            await addDoc(machinesCol, { 
                name: nameInput.value.trim(), 
                code: codeInput ? codeInput.value.trim() : '-', 
                createdAt: Date.now() 
            });
            nameInput.value = '';
            if (codeInput) codeInput.value = '';
            alert("Máquina salva com SUCESSO no Firebase!");
        } catch (error) {
            console.error("Erro ao salvar máquina:", error);
            alert("Erro ao salvar máquina no Firebase: " + error.message);
        }
    });
}

window.addMachineItem = async (machineId) => {
    const name = prompt("Nome do Item / Conjunto (Ex: Unidade de Injeção, Cabeçote, Motor):");
    if (!name || !name.trim()) return;

    const code = prompt("Código do Item / Conjunto (Ex: CONJ-01 / Protheus):") || "-";

    await addDoc(machineItemsCol, {
        machineId,
        name: name.trim(),
        code: code.trim(),
        createdAt: Date.now()
    });
};

window.addMachineSubitem = async (machineId, itemId) => {
    const name = prompt("Nome da Peça / Subitem (Ex: Rolamento, Trafo, Válvula):");
    if (!name || !name.trim()) return;

    const code = prompt("Código Protheus / Fabricante da peça:") || "-";
    const qtyStr = prompt("Quantidade necessária / em estoque:") || "1";

    await addDoc(machineSubitemsCol, {
        machineId,
        itemId,
        name: name.trim(),
        code: code.trim(),
        qty: Number(qtyStr) || 1,
        createdAt: Date.now()
    });
};

window.deleteMachine = async (id) => {
    if (confirm("Remover esta máquina e todos os seus itens?")) {
        await deleteDoc(doc(db, "machines", id));
    }
};

window.deleteMachineItem = async (id) => {
    if (confirm("Remover este conjunto/item?")) {
        await deleteDoc(doc(db, "machine_items", id));
    }
};

window.deleteMachineSubitem = async (id) => {
    if (confirm("Remover esta peça/subitem?")) {
        await deleteDoc(doc(db, "machine_subitems", id));
    }
};

function listenToMachinesTree() {
    const qM = query(machinesCol, orderBy("createdAt", "asc"));
    const qI = query(machineItemsCol, orderBy("createdAt", "asc"));
    const qS = query(machineSubitemsCol, orderBy("createdAt", "asc"));

    let machinesArr = [], itemsArr = [], subitemsArr = [];

    const renderTree = () => {
        const container = document.getElementById('machines-tree-container');
        if (!container) return;

        const openCards = Array.from(container.querySelectorAll('.shelf-card.active')).map(el => el.dataset.id);
        container.innerHTML = '';

        if (machinesArr.length === 0) {
            container.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding: 30px;">Nenhuma máquina cadastrada.</p>`;
            return;
        }

        machinesArr.forEach(m => {
            const mItems = itemsArr.filter(i => i.machineId === m.id);
            const isActive = openCards.includes(m.id) ? 'active' : '';

            let itemsHTML = mItems.map(item => {
                const itemSubitems = subitemsArr.filter(s => s.itemId === item.id);

                let subitemsHTML = itemSubitems.map(sub => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <td style="padding: 6px;"><i class="fas fa-wrench" style="color:var(--accent); font-size:11px;"></i> <strong>${sub.name}</strong></td>
                        <td style="padding: 6px;"><code>${sub.code}</code></td>
                        <td style="padding: 6px;"><span class="status-pill pill-blue">${sub.qty} un</span></td>
                        <td style="padding: 6px; text-align: right;" class="adm-only">
                            <button class="btn-action pill-red" style="width:24px; height:24px; font-size:10px;" onclick="deleteMachineSubitem('${sub.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');

                return `
                    <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px; margin-top: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                            <h5 style="color: var(--accent); font-size: 14px; margin:0;">
                                <i class="fas fa-layer-group"></i> ${item.name} 
                                <small style="color:var(--text-dim); font-size:12px; font-weight:normal;">(${item.code || '-'})</small>
                            </h5>
                            <div class="adm-only" style="display:flex; gap:6px;">
                                <button class="btn-submit" style="padding: 4px 8px; font-size: 11px;" onclick="addMachineSubitem('${m.id}', '${item.id}')">
                                    <i class="fas fa-plus"></i> Add Peça / Subitem
                                </button>
                                <button class="btn-action pill-red" style="width:26px; height:26px; font-size:11px;" onclick="deleteMachineItem('${item.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>

                        ${itemSubitems.length > 0 ? `
                            <table style="width:100%; font-size:12px; text-align:left; border-collapse:collapse;">
                                <thead>
                                    <tr style="color:var(--text-dim); font-size:11px;">
                                        <th>Peça / Subitem</th>
                                        <th>Código Peça</th>
                                        <th>Qtd</th>
                                        <th class="adm-only" style="text-align:right;">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>${subitemsHTML}</tbody>
                            </table>
                        ` : `<p style="font-size:12px; color:var(--text-dim); margin:4px 0;">Nenhum subitem/peça cadastrado neste conjunto.</p>`}
                    </div>
                `;
            }).join('');

            const card = document.createElement('div');
            card.className = `shelf-card ${isActive}`;
            card.dataset.id = m.id;
            card.innerHTML = `
                <div class="shelf-top" onclick="this.parentElement.classList.toggle('active')">
                    <div class="shelf-id"><i class="fas fa-industry"></i></div>
                    <div class="shelf-info">
                        <h4>${m.name} <small style="color:var(--text-dim);">(${m.code || '-'})</small></h4>
                        <p>${mItems.length} conjuntos de peças</p>
                    </div>
                    <button class="btn-action pill-red adm-only" style="width:auto; padding:4px 10px; font-size:12px;" onclick="event.stopPropagation(); deleteMachine('${m.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="shelf-details" style="padding-top: 10px;">
                    <button class="btn-submit adm-only" style="width:100%; padding:8px; font-size:12px; background:rgba(255,255,255,0.05); border:1px dashed var(--text-dim); color:white;" onclick="addMachineItem('${m.id}')">
                        <i class="fas fa-plus"></i> Adicionar Item / Conjunto
                    </button>
                    ${itemsHTML}
                </div>
            `;
            container.appendChild(card);
        });
    };

    onSnapshot(qM, snap => { machinesArr = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderTree(); });
    onSnapshot(qI, snap => { itemsArr = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderTree(); });
    onSnapshot(qS, snap => { subitemsArr = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderTree(); });
}

// ==========================================
// PRATELEIRAS DINÂMICAS (FIREBASE)
// ==========================================
const shelvesCollection = collection(db, "shelves");

const formShelf = document.getElementById('form-shelf') || document.getElementById('shelf-form');
if (formShelf) {
    formShelf.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('shelf-name');
        if (!nameInput || !nameInput.value.trim()) {
            alert("Digite o nome da prateleira!");
            return;
        }

        try {
            await addDoc(shelvesCollection, { 
                name: nameInput.value.trim(), 
                createdAt: Date.now() 
            });
            nameInput.value = '';
            alert("Prateleira salva com SUCESSO no Firebase!");
        } catch (error) {
            console.error("Erro ao salvar prateleira:", error);
            alert("Erro ao salvar prateleira no Firebase: " + error.message);
        }
    });
}

window.deleteShelf = async (id) => {
    if(confirm("Excluir esta prateleira?")) {
        await deleteDoc(doc(db, "shelves", id));
    }
};

// Preenche o <select> com 1-14 + Dinâmicas
function populateShelfSelect(dynamicSnap) {
    const select = document.getElementById('p-shelf');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = ''; 

    // 1. Adiciona as 14 prateleiras fixas
    for (let i = 1; i <= 14; i++) {
        const opt = document.createElement('option');
        const num = i.toString().padStart(2, '0');
        opt.value = i; 
        opt.textContent = `Prateleira ${num}`;
        select.appendChild(opt);
    }

    // 2. Adiciona as prateleiras dinâmicas do Firebase
    if (dynamicSnap) {
        dynamicSnap.forEach((docSnap) => {
            const shelf = docSnap.data();
            const opt = document.createElement('option');
            opt.value = docSnap.id; 
            opt.textContent = shelf.name;
            select.appendChild(opt);
        });
    }

    if (currentVal) select.value = currentVal;
}

// Escuta em tempo real do banco
function listenToDynamicShelves() {
    const q = query(shelvesCollection, orderBy("createdAt", "asc"));
    
    onSnapshot(q, (snapshot) => {
        currentDynamicShelves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Atualiza a lista suspensa no cadastro
        populateShelfSelect(snapshot);

        // Atualiza a tela central
        renderAll();
    });
}

// Inicia os ouvintes e o aplicativo
listenToDynamicShelves();
listenToMachinesTree();
init();