import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import InsuranceArtifact from './abis/Insurance.json';
import ContractAddressInfo from './abis/contract-address.json';

const CONTRACT_ADDRESS = ContractAddressInfo.address;

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastError, setLastError] = useState(null);
  
  const [policies, setPolicies] = useState([]);
  const [ownedPolicies, setOwnedPolicies] = useState([]);
  const [claims, setClaims] = useState([]);

  // Form states
  const [newPolicy, setNewPolicy] = useState({ name: "", premium: "", payout: "" });
  const [claimDesc, setClaimDesc] = useState({});
  const [resolveMsgs, setResolveMsgs] = useState({});
  const [newAdminAddr, setNewAdminAddr] = useState("");
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", premium: "", payout: "", isActive: true });
  const [adminList, setAdminList] = useState([]);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(_provider);
        
        // Listen to account changes
        window.ethereum.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            connectWallet();
          } else {
            setAccount("");
            setIsAdmin(false);
          }
        });
      } catch (error) {
        console.error("Error init:", error);
      }
    } else {
      console.error("Please install MetaMask!");
    }
  };

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }], // 31337 w hex
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x7A69',
                chainName: 'Hardhat Localhost',
                rpcUrls: ['http://127.0.0.1:8545/'],
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
              },
            ],
          });
        } catch (addError) {
          console.error("Błąd dodawania sieci", addError);
        }
      }
    }
  };

  const disconnectWallet = () => {
    setAccount("");
    setSigner(null);
    setContract(null);
    setIsAdmin(false);
    setPolicies([]);
    setClaims([]);
    setLastError(null);
  };

  const connectWallet = async () => {
    if (!provider) return;
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      const _signer = await provider.getSigner();
      setSigner(_signer);
      setAccount(accounts[0]);

      const network = await provider.getNetwork();
      if (network.chainId !== 31337n) {
        throw new Error(`Podłączono do złej sieci (Chain ID: ${network.chainId.toString()}). Wymagana sieć to Localhost (31337). Użyj przycisku poniżej, aby zmienić.`);
      }

      const _contract = new ethers.Contract(CONTRACT_ADDRESS, InsuranceArtifact.abi, _signer);
      setContract(_contract);

      try {
        // Check admin
        const isAdminUser = await _contract.admins(accounts[0]);
        console.log("Connected account:", accounts[0]);
        console.log("Is Admin:", isAdminUser);
        setIsAdmin(isAdminUser);
        loadData(_contract, accounts[0]);
      } catch (e) {
        console.error("Contract call failed. Are you on the right network (Localhost 8545)?", e);
        setLastError(e.message || JSON.stringify(e));
      }
    } catch (error) {
      console.error("Connection error:", error);
      setLastError(error.message || JSON.stringify(error));
    }
  };

  const loadData = async (_contract, userAccount) => {
    try {
      // Load policies
      const pCount = await _contract.policyCount();
      let loadedPolicies = [];
      let loadedOwnedPolicies = [];
      for (let i = 1; i <= pCount; i++) {
        const p = await _contract.policies(i);
        const hasPol = await _contract.hasPolicy(userAccount, i);
        
        const polObj = {
          id: p.id.toString(),
          name: p.name,
          premium: ethers.formatEther(p.premium),
          payout: ethers.formatEther(p.payout),
          isActive: p.isActive,
          owned: hasPol
        };
        
        loadedPolicies.push(polObj);
        if (hasPol) {
          loadedOwnedPolicies.push(polObj);
        }
      }
      setPolicies(loadedPolicies);
      setOwnedPolicies(loadedOwnedPolicies);

      // Load admins
      const adminsArray = await _contract.getAdmins();
      setAdminList(adminsArray);

      // Load claims
      const cCount = await _contract.claimCount();
      let loadedClaims = [];
      for (let i = 1; i <= cCount; i++) {
        const c = await _contract.claims(i);
        loadedClaims.push({
          id: c.id.toString(),
          policyholder: c.policyholder,
          policyId: c.policyId.toString(),
          description: c.description,
          isApproved: c.isApproved,
          isResolved: c.isResolved,
          resolveMessage: c.resolveMessage
        });
      }
      setClaims(loadedClaims);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const createPolicy = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const prem = ethers.parseEther(newPolicy.premium);
      const pay = ethers.parseEther(newPolicy.payout);
      const tx = await contract.createPolicy(newPolicy.name, prem, pay);
      await tx.wait();
      loadData(contract, account);
      setNewPolicy({ name: "", premium: "", payout: "" });
    } catch (error) {
      console.error("Create policy error:", error);
      alert("Error creating policy");
    }
  };

  const startEditing = (p) => {
    setEditingPolicyId(p.id);
    setEditForm({ name: p.name, premium: p.premium, payout: p.payout, isActive: p.isActive });
  };

  const cancelEditing = () => {
    setEditingPolicyId(null);
  };

  const submitEditPolicy = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const prem = ethers.parseEther(editForm.premium.toString());
      const pay = ethers.parseEther(editForm.payout.toString());
      const tx = await contract.editPolicy(editingPolicyId, editForm.name, prem, pay, editForm.isActive);
      await tx.wait();
      setEditingPolicyId(null);
      loadData(contract, account);
      alert("Policy updated!");
    } catch (error) {
      console.error("Edit policy error:", error);
      alert("Error editing policy");
    }
  };

  const buyPolicy = async (policy) => {
    if (!contract) return;
    try {
      const tx = await contract.buyPolicy(policy.id, { value: ethers.parseEther(policy.premium) });
      await tx.wait();
      alert("Policy purchased successfully!");
      loadData(contract, account);
    } catch (error) {
      console.error("Buy policy error:", error);
      alert("Failed to buy policy. Maybe you already have it?");
    }
  };

  const submitClaim = async (policyId) => {
    if (!contract) return;
    try {
      const desc = claimDesc[policyId] || "Brak opisu";
      const tx = await contract.submitClaim(policyId, desc);
      await tx.wait();
      alert("Claim submitted successfully!");
      loadData(contract, account);
      setClaimDesc({ ...claimDesc, [policyId]: "" });
    } catch (error) {
      console.error("Submit claim error:", error);
      alert("Error submitting claim. Do you own this policy?");
    }
  };

  const resolveClaim = async (claimId, approve) => {
    if (!contract) return;
    try {
      const rMsg = resolveMsgs[claimId] || "";
      const tx = await contract.resolveClaim(claimId, approve, rMsg);
      await tx.wait();
      alert("Claim resolved!");
      loadData(contract, account);
    } catch (error) {
      console.error("Resolve claim error:", error);
      alert("Error resolving claim. Ensure contract has enough ETH.");
    }
  };

  const fundContract = async () => {
    if (!signer) return;
    try {
      const tx = await signer.sendTransaction({
        to: CONTRACT_ADDRESS,
        value: ethers.parseEther("10.0") // Fund with 10 ETH
      });
      await tx.wait();
      alert("Contract funded!");
    } catch (error) {
      console.error("Fund error:", error);
    }
  };

  const addAdmin = async (e) => {
    e.preventDefault();
    if (!contract) return;
    try {
      const tx = await contract.addAdmin(newAdminAddr);
      await tx.wait();
      alert("Dodano nowego administratora!");
      setNewAdminAddr("");
      loadData(contract, account);
    } catch (error) {
      console.error("Add admin error:", error);
      alert("Błąd podczas dodawania administratora.");
    }
  };

  const removeAdmin = async (adminAddr) => {
    if (!contract) return;
    try {
      const tx = await contract.removeAdmin(adminAddr);
      await tx.wait();
      alert("Administrator usunięty!");
      loadData(contract, account);
    } catch (error) {
      console.error("Remove admin error:", error);
      alert("Błąd podczas usuwania administratora.");
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <div className="card shadow mb-4">
        <div className="card-body d-flex justify-content-between align-items-center">
          <h2 className="card-title mb-0">Zdecentralizowane Ubezpieczenia</h2>
          {account ? (
            <div className="d-flex align-items-center gap-3">
              <span className="badge bg-success p-2 fs-6">
                Połączono: {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </span>
              <button className="btn btn-sm btn-outline-danger fw-bold" onClick={disconnectWallet}>Wyloguj</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connectWallet}>Połącz z MetaMask</button>
          )}
        </div>
      </div>

      {lastError && (
        <div className="alert alert-danger shadow-sm">
          <strong>Błąd:</strong> {lastError}
          <br/><br/>
          <button className="btn btn-sm btn-outline-danger" onClick={switchNetwork}>Automatycznie połącz z siecią testową</button>
        </div>
      )}

      {!account && !lastError && (
        <div className="alert alert-info text-center shadow-sm">
          <strong>Uwaga!</strong> Połącz swój portfel MetaMask, aby przeglądać i kupować polisy ubezpieczeniowe.
        </div>
      )}

      {account && (
        <div className="row">
          {/* USER PANEL */}
          <div className={isAdmin ? "col-md-6" : "col-md-12"}>
            
            {/* POSIADANE POLISY (NOWA TABELA) */}
            <div className="card shadow mb-4 border-success">
              <div className="card-header bg-success text-white">
                <h4 className="mb-0">Twoje Polisy (Zgłaszanie Szkód)</h4>
              </div>
              <div className="card-body p-0">
                {ownedPolicies.length === 0 ? (
                  <p className="text-muted text-center p-4 mb-0">Nie posiadasz jeszcze żadnych polis.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Polisa</th>
                          <th>Wypłata</th>
                          <th>Akcja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownedPolicies.map(p => (
                          <tr key={`owned-${p.id}`}>
                            <td><strong>{p.name}</strong></td>
                            <td>{p.payout} ETH</td>
                            <td>
                              <div className="input-group input-group-sm" style={{ minWidth: '250px' }}>
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  placeholder="Opis roszczenia" 
                                  value={claimDesc[p.id] || ''} 
                                  onChange={(e) => setClaimDesc({...claimDesc, [p.id]: e.target.value})}
                                />
                                <button className="btn btn-danger" onClick={() => submitClaim(p.id)}>Zgłoś szkodę</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* DOSTĘPNE POLISY */}
            <div className="card shadow mb-4">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">Dostępne Polisy (Sklep)</h4>
              </div>
              <div className="card-body">
                {policies.length === 0 ? <p className="text-muted text-center">Brak zdefiniowanych polis w systemie.</p> : (
                  <div className="list-group">
                    {policies.map(p => (
                      <div key={`avail-${p.id}`} className="list-group-item flex-column align-items-start shadow-sm mb-3 rounded">
                        {editingPolicyId === p.id ? (
                          <form onSubmit={submitEditPolicy}>
                            <div className="mb-2">
                              <label>Nazwa</label>
                              <input type="text" className="form-control form-control-sm" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                            </div>
                            <div className="row mb-2">
                              <div className="col">
                                <label>Składka (ETH)</label>
                                <input type="number" step="0.0001" className="form-control form-control-sm" value={editForm.premium} onChange={e => setEditForm({...editForm, premium: e.target.value})} required />
                              </div>
                              <div className="col">
                                <label>Wypłata (ETH)</label>
                                <input type="number" step="0.0001" className="form-control form-control-sm" value={editForm.payout} onChange={e => setEditForm({...editForm, payout: e.target.value})} required />
                              </div>
                            </div>
                            <div className="form-check mb-2">
                              <input className="form-check-input" type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({...editForm, isActive: e.target.checked})} id={`active-${p.id}`} />
                              <label className="form-check-label" htmlFor={`active-${p.id}`}>Aktywna</label>
                            </div>
                            <div className="d-flex gap-2">
                              <button type="submit" className="btn btn-sm btn-success w-50">Zapisz</button>
                              <button type="button" className="btn btn-sm btn-secondary w-50" onClick={cancelEditing}>Anuluj</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="d-flex w-100 justify-content-between mb-2">
                              <h5 className="mb-1">
                                {p.name} {!p.isActive && <span className="badge bg-danger ms-2">Nieaktywna</span>}
                              </h5>
                              <span className="badge bg-primary rounded-pill d-flex align-items-center px-3">Wypłata: {p.payout} ETH</span>
                            </div>
                            <p className="mb-2 text-muted"><strong>Składka:</strong> {p.premium} ETH</p>
                            
                            <div className="d-flex mt-3 gap-2">
                              {p.owned ? (
                                <button className="btn btn-secondary w-100" disabled>Posiadasz już tę polisę</button>
                              ) : (
                                <button className="btn btn-success w-100 fw-bold" onClick={() => buyPolicy(p)} disabled={!p.isActive}>Kup polisę</button>
                              )}
                              {isAdmin && (
                                <button className="btn btn-warning w-100 fw-bold" onClick={() => startEditing(p)}>Edytuj</button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TWOJE ZGŁOSZONE SZKODY (NOWA TABELA) */}
            <div className="card shadow mb-4 border-info">
              <div className="card-header bg-info text-dark">
                <h4 className="mb-0">Twoje Zgłoszone Szkody</h4>
              </div>
              <div className="card-body p-0">
                {claims.filter(c => c.policyholder.toLowerCase() === account.toLowerCase()).length === 0 ? (
                  <p className="text-muted text-center p-4 mb-0">Nie zgłosiłeś jeszcze żadnych szkód.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>ID Polisy</th>
                          <th>Opis Roszczenia</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {claims.filter(c => c.policyholder.toLowerCase() === account.toLowerCase()).map(c => (
                          <tr key={`user-claim-${c.id}`}>
                            <td><strong>#{c.policyId}</strong></td>
                            <td>{c.description}</td>
                            <td>
                              <span className={`badge ${c.isResolved ? (c.isApproved ? 'bg-success' : 'bg-danger') : 'bg-secondary'}`}>
                                {c.isResolved ? (c.isApproved ? 'Zatwierdzone' : 'Odrzucone') : 'Oczekujące'}
                              </span>
                              {c.resolveMessage && <div className="mt-1 small text-muted"><strong>Wiadomość:</strong> {c.resolveMessage}</div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ADMIN PANEL */}
          {isAdmin && (
            <div className="col-md-6">
              <div className="card shadow mb-4 border-warning">
                <div className="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
                  <h4 className="mb-0">Panel Administratora</h4>
                  <button className="btn btn-sm btn-dark" onClick={fundContract}>Zasil Kontrakt (10 ETH)</button>
                </div>
                <div className="card-body bg-light">
                  <h5 className="border-bottom pb-2 mb-3">Zarządzanie Administratorami</h5>
                  <div className="table-responsive mb-4">
                    <table className="table table-sm table-bordered bg-white">
                      <thead className="table-light">
                        <tr>
                          <th>Adres publiczny</th>
                          <th style={{width: "80px"}}>Akcja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminList.map(a => (
                          <tr key={a}>
                            <td className="align-middle text-break">{a} {a.toLowerCase() === account.toLowerCase() && <span className="badge bg-secondary ms-2">Ty</span>}</td>
                            <td>
                              <button 
                                className="btn btn-sm btn-outline-danger" 
                                onClick={() => removeAdmin(a)}
                                disabled={a.toLowerCase() === account.toLowerCase()}
                              >
                                Usuń
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <form onSubmit={addAdmin} className="mb-4 d-flex gap-2">
                    <input type="text" className="form-control" placeholder="Adres nowego administratora (0x...)" required value={newAdminAddr} onChange={e => setNewAdminAddr(e.target.value)} />
                    <button type="submit" className="btn btn-dark px-4">Dodaj</button>
                  </form>

                  <h5 className="border-bottom pb-2 mb-3">Utwórz nową polisę</h5>
                  <form onSubmit={createPolicy} className="mb-4">
                    <div className="mb-2">
                      <input type="text" className="form-control" placeholder="Nazwa polisy (np. Ubezpieczenie lotu)" required value={newPolicy.name} onChange={e => setNewPolicy({...newPolicy, name: e.target.value})} />
                    </div>
                    <div className="mb-2 d-flex gap-2">
                      <div className="w-50">
                        <label className="form-label small text-muted mb-0">Składka (ETH)</label>
                        <input type="number" step="0.0001" className="form-control" required value={newPolicy.premium} onChange={e => setNewPolicy({...newPolicy, premium: e.target.value})} />
                      </div>
                      <div className="w-50">
                        <label className="form-label small text-muted mb-0">Wypłata (ETH)</label>
                        <input type="number" step="0.0001" className="form-control" required value={newPolicy.payout} onChange={e => setNewPolicy({...newPolicy, payout: e.target.value})} />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-warning w-100">Utwórz ofertę</button>
                  </form>

                  <h5 className="border-bottom pb-2 mb-3 mt-4">Zarządzanie Roszczeniami</h5>
                  {claims.length === 0 ? <p className="text-muted text-center">Brak zgłoszeń w systemie.</p> : (
                    <div className="list-group">
                      {claims.map(c => (
                        <div key={c.id} className="list-group-item shadow-sm mb-2 rounded border-0">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <strong>Polisa ID: {c.policyId}</strong>
                              <br/>
                              <small className="text-muted">Od: {c.policyholder.substring(0,8)}...{c.policyholder.substring(36)}</small>
                            </div>
                            <span className={`badge ${c.isResolved ? (c.isApproved ? 'bg-success' : 'bg-danger') : 'bg-secondary'}`}>
                              {c.isResolved ? (c.isApproved ? 'Zatwierdzone' : 'Odrzucone') : 'Oczekujące'}
                            </span>
                          </div>
                          <p className="mb-2 bg-white p-2 rounded border"><strong>Opis:</strong> {c.description}</p>
                          {!c.isResolved && (
                            <div className="d-flex flex-column gap-2">
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                placeholder="Wiadomość zwrotna (opcjonalnie)" 
                                value={resolveMsgs[c.id] || ''} 
                                onChange={(e) => setResolveMsgs({...resolveMsgs, [c.id]: e.target.value})}
                              />
                              <div className="d-flex gap-2">
                                <button className="btn btn-sm btn-success w-50" onClick={() => resolveClaim(c.id, true)}>Zatwierdź Wypłatę</button>
                                <button className="btn btn-sm btn-danger w-50" onClick={() => resolveClaim(c.id, false)}>Odrzuć Roszczenie</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
