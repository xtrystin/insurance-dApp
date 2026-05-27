# Dokumentacja funkcjonalna aplikacji Insurance DApp

## 1. Cel aplikacji

Insurance DApp to zdecentralizowana aplikacja do obsługi prostych polis ubezpieczeniowych. System pozwala administratorowi tworzyć oferty polis, zarządzać administratorami, zasilać kontrakt środkami testowymi oraz rozpatrywać zgłoszone szkody. Użytkownik może kupić polisę, zgłosić szkodę i otrzymać wypłatę ETH po zatwierdzeniu zgłoszenia.

Aplikacja działa bez klasycznej bazy danych. Głównym źródłem prawdy jest smart kontrakt `Insurance` wdrożony na blockchainie. Frontend tylko odczytuje dane z kontraktu i wysyła transakcje podpisywane przez MetaMask.

## 2. Role w systemie

### Administrator

Administrator to adres portfela zapisany w kontrakcie w mapie `admins`. Pierwszym administratorem zostaje konto, które wdraża kontrakt. Przy lokalnym uruchomieniu Hardhat jest to zwykle `Account #0`.

Administrator może:

- zasilić kontrakt środkami ETH na przyszłe wypłaty,
- tworzyć nowe polisy,
- edytować istniejące polisy,
- aktywować i dezaktywować polisy,
- dodawać nowych administratorów,
- usuwać administratorów, z ograniczeniem że nie można usunąć ostatniego administratora ani samego siebie,
- przeglądać wszystkie zgłoszenia szkód,
- zatwierdzać lub odrzucać zgłoszenia szkód,
- wpisać wiadomość zwrotną przy rozpatrywaniu szkody.

### Użytkownik

Użytkownik to dowolny adres portfela, który nie musi być administratorem. Przy lokalnym testowaniu najczęściej używa się `Account #1`.

Użytkownik może:

- przeglądać dostępne polisy,
- kupić aktywną polisę,
- zobaczyć swoje kupione polisy,
- zgłosić szkodę do posiadanej polisy,
- sprawdzić status swoich zgłoszeń,
- otrzymać wypłatę ETH po zatwierdzeniu szkody przez administratora.

## 3. Architektura projektu

Projekt składa się z dwóch głównych części:

- `smart-contracts` - smart kontrakt Solidity, konfiguracja Hardhat, skrypty deployu i testy kontraktu.
- `frontend` - aplikacja React + Vite komunikująca się z kontraktem przez `ethers` i MetaMask.

Nie ma backendu ani bazy danych. Stan biznesowy znajduje się w kontrakcie:

- definicje polis,
- zakupione polisy,
- zgłoszone szkody,
- statusy szkód,
- administratorzy,
- saldo kontraktu.

Plik `frontend/src/contracts/deployments.json` nie jest bazą danych. To manifest techniczny generowany podczas deployu. Zawiera adres kontraktu, ABI i hash bytecode'u dla danej sieci, aby frontend wiedział, z którym kontraktem ma rozmawiać.

## 4. Smart kontrakt `Insurance`

Kontrakt znajduje się w:

```text
smart-contracts/contracts/Insurance.sol
```

### Polisa

Polisa ma następujące pola:

- `id` - identyfikator polisy,
- `name` - nazwa polisy,
- `premium` - składka wymagana przy zakupie,
- `payout` - kwota wypłaty przy zaakceptowanej szkodzie,
- `isActive` - informacja, czy polisę można kupić.

Administrator tworzy i edytuje polisy. Użytkownik może kupić tylko aktywną polisę i tylko raz dla danego `policyId`.

### Szkoda

Zgłoszenie szkody ma następujące pola:

- `id` - identyfikator szkody,
- `policyholder` - adres użytkownika zgłaszającego szkodę,
- `policyId` - identyfikator polisy,
- `description` - opis szkody,
- `payoutAmount` - kwota wypłaty zapisana w momencie zgłoszenia,
- `isApproved` - czy szkoda została zatwierdzona,
- `isResolved` - czy szkoda została rozpatrzona,
- `resolveMessage` - wiadomość zwrotna administratora.

Ważne: przy zakupie polisy kontrakt zapisuje kwotę wypłaty obowiązującą w momencie zakupu. Dzięki temu późniejsza edycja polisy przez administratora nie zmienia warunków już zakupionej ochrony.

### Zasilanie kontraktu

Kontrakt musi mieć ETH, aby móc wypłacać środki użytkownikom. Administrator zasila kontrakt przez funkcję:

```solidity
fund()
```

Po zasileniu emitowany jest event:

```solidity
ContractFunded(address funder, uint256 amount)
```

W panelu administratora widoczne jest aktualne saldo kontraktu.

### Rozpatrywanie szkody

Administrator rozpatruje szkodę funkcją:

```solidity
resolveClaim(uint256 claimId, bool approve, string message)
```

Jeśli `approve` jest równe `true`, kontrakt:

1. sprawdza, czy posiada wystarczające saldo,
2. oznacza szkodę jako rozpatrzoną i zatwierdzoną,
3. wysyła ETH do użytkownika,
4. emituje event `PayoutSent`.

Event wypłaty:

```solidity
PayoutSent(uint256 claimId, address policyholder, uint256 amount)
```

Wypłata jest wykonywana wewnątrz transakcji administratora. Użytkownik może nie zobaczyć osobnej transakcji przychodzącej w MetaMask, ale jego saldo powinno wzrosnąć.

## 5. Frontend

Frontend znajduje się w:

```text
frontend/src/App.jsx
```

Aplikacja:

- łączy się z MetaMask,
- sprawdza, czy użytkownik jest na sieci `31337`,
- pobiera deployment z `frontend/src/contracts/deployments.json`,
- sprawdza, czy bytecode pod adresem kontraktu pasuje do manifestu,
- tworzy instancję kontraktu przez `ethers.Contract`,
- odczytuje polisy, zgłoszenia, administratorów i saldo kontraktu,
- wysyła transakcje użytkownika lub administratora.

Jeśli ABI frontendu nie pasuje do kontraktu wdrożonego na lokalnym blockchainie, aplikacja powinna pokazać błąd o niezgodności kontraktu. W takim przypadku trzeba zrestartować lokalny Hardhat node, ponownie wdrożyć kontrakt i odświeżyć frontend.

## 6. Przepływ administratora

Typowy przepływ administratora:

1. Uruchamia lokalny blockchain Hardhat.
2. Wdraża kontrakt.
3. Uruchamia frontend.
4. Importuje `Account #0` do MetaMask.
5. Łączy portfel z aplikacją.
6. Widzi panel administratora.
7. Zasila kontrakt przyciskiem `Zasil Kontrakt (10 ETH)`.
8. Tworzy polisę, podając nazwę, składkę i kwotę wypłaty.
9. Po zgłoszeniu szkody przez użytkownika przechodzi do sekcji zarządzania roszczeniami.
10. Zatwierdza albo odrzuca szkodę.

Jeśli szkoda zostanie zatwierdzona, kontrakt wypłaca użytkownikowi kwotę zapisaną dla danej szkody.

## 7. Przepływ użytkownika

Typowy przepływ użytkownika:

1. Importuje `Account #1` lub inne konto testowe do MetaMask.
2. Przełącza MetaMask na konto użytkownika.
3. Łączy portfel z aplikacją.
4. W sekcji `Dostępne Polisy (Sklep)` wybiera aktywną polisę.
5. Klika `Kup polisę` i zatwierdza transakcję.
6. Kupiona polisa pojawia się w sekcji `Twoje Polisy`.
7. Użytkownik wpisuje opis szkody i klika `Zgłoś szkodę`.
8. Zgłoszenie pojawia się w sekcji `Twoje Zgłoszone Szkody`.
9. Po decyzji administratora użytkownik widzi status `Zatwierdzone` albo `Odrzucone`.
10. Przy zatwierdzeniu saldo użytkownika wzrasta o kwotę wypłaty.

## 8. Uruchomienie lokalne

### Terminal 1: blockchain

```bash
cd smart-contracts
npm install
npm run node
```

Terminal musi pozostać uruchomiony. Hardhat pokaże listę kont testowych i ich kluczy prywatnych.

### Terminal 2: deploy kontraktu

```bash
cd smart-contracts
npm run deploy:localhost
```

Po deployu aktualizowany jest:

```text
frontend/src/contracts/deployments.json
```

### Terminal 3: frontend

```bash
cd frontend
npm install
npm run dev
```

Aplikacja działa zwykle pod:

```text
http://localhost:5173/
```

Jeśli port jest zajęty, Vite wybierze kolejny, np. `5174`.

## 9. Konfiguracja MetaMask

Należy dodać lokalną sieć:

- Network name: `Hardhat Localhost`
- RPC URL: `http://127.0.0.1:8545/`
- Chain ID: `31337`
- Currency symbol: `ETH`

Do testów należy zaimportować konta z terminala Hardhat:

- `Account #0` jako administrator,
- `Account #1` jako użytkownik.

## 10. Diagnostyka

Projekt zawiera skrypt diagnostyczny:

```bash
cd smart-contracts
npm run check:localhost
```

Skrypt sprawdza:

- Chain ID,
- adres kontraktu,
- oczekiwany hash bytecode'u,
- rzeczywisty hash bytecode'u na blockchainie,
- czy bytecode pasuje do manifestu,
- czy deployer jest administratorem,
- saldo kontraktu,
- liczbę polis,
- czy da się oszacować transakcję `fund()`.

Najważniejsza linia:

```text
bytecode matches: true
```

Jeśli wartość to `false`, frontend i lokalny blockchain są niespójne. Trzeba zrestartować `npm run node`, ponownie wykonać `npm run deploy:localhost` i odświeżyć frontend.

## 11. Typowe logi Hardhata

Poprawne zasilenie kontraktu wygląda podobnie do:

```text
eth_sendRawTransaction
  Contract call: Insurance#fund
  Value: 10. ETH
```

Poprawne zatwierdzenie szkody wygląda jak wywołanie:

```text
Contract call: Insurance#resolveClaim
```

Wypłata do użytkownika jest transferem wewnętrznym w tej samej transakcji. Nie musi pojawić się w MetaMask jako osobna transakcja użytkownika. Można ją potwierdzić przez saldo użytkownika albo event `PayoutSent`.

Logi typu:

```text
Insurance#<unrecognized-selector>
```

mogą pojawiać się jako dodatkowe `eth_call` wykonywane przez MetaMask lub narzędzia diagnostyczne. Same w sobie nie oznaczają nieudanej transakcji. Jeśli właściwa transakcja `Insurance#fund` albo `Insurance#resolveClaim` została wydobyta w bloku, operacja została wykonana.

## 12. Testy

Testy kontraktu znajdują się w:

```text
smart-contracts/test/Insurance.js
```

Uruchomienie:

```bash
cd smart-contracts
npm test
```

Testy sprawdzają między innymi:

- tworzenie i zakup polis,
- walidację danych wejściowych,
- zasilanie kontraktu,
- saldo kontraktu,
- zgłaszanie szkód,
- wypłaty ETH,
- zachowanie kwoty wypłaty po edycji polisy,
- ograniczenia zarządzania administratorami.

## 13. Najważniejsze założenia bezpieczeństwa

- Tylko administrator może tworzyć i edytować polisy oraz rozpatrywać szkody.
- Nie można dodać administratora o adresie zerowym.
- Nie można usunąć ostatniego administratora.
- Nie można usunąć samego siebie z roli administratora.
- Nie można kupić tej samej polisy dwa razy z tego samego adresu.
- Nie można zgłosić szkody do polisy, której użytkownik nie posiada.
- Kontrakt waliduje puste teksty, zbyt długie teksty i zerowe kwoty.
- Wypłata używa mechanizmu `call` z prostą ochroną przed reentrancy.
- Kwota wypłaty użytkownika jest utrwalana na podstawie warunków z momentu zakupu polisy.

## 14. Ograniczenia obecnej wersji

- Aplikacja jest demonstracją lokalną i używa testowego ETH.
- Nie ma procesu weryfikacji realnych szkód poza decyzją administratora.
- Nie ma zewnętrznego oracle ani automatycznego sprawdzania zdarzeń.
- Dane są publiczne na blockchainie, w tym opisy szkód.
- Nie ma produkcyjnego systemu uprawnień poza listą administratorów w kontrakcie.
- Frontend zakłada lokalną sieć Hardhat o Chain ID `31337`.
