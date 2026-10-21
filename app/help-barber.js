// Keep — Barbershop user guide and FAQ (English + Kiswahili).
// Loaded by help.html; shown when the help page is opened from a barbershop (help.html?m=barbershop).
const BO = { en: '<span class="who o">Owner</span>', sw: '<span class="who o">Mmiliki</span>' };
const BF = { en: '<span class="who s">Front desk</span>', sw: '<span class="who s">Mapokezi</span>' };
const faqList = items => items.map(([q, a]) => `<details><summary>${q}</summary><div><p>${a}</p></div></details>`).join('');

const BARBER = {
guide: {
en: () => `
<h1>How to use Keep in a barbershop</h1>
<p class="lead">The guide for barbershop owners and front desk. Labels like ${BO.en} or ${BF.en} show who usually does each step. The owner can do everything.</p>
<div class="toc"><ol>
<li><a href="#b1">Who uses Keep</a></li><li><a href="#b2">Setting up (first day)</a></li><li><a href="#b3">Recording a client</a></li>
<li><a href="#b4">Mistakes and changes</a></li><li><a href="#b5">How barbers are paid</a></li><li><a href="#b6">Paying barbers</a></li>
<li><a href="#b7">Ending a shift and closing the day</a></li><li><a href="#b8">The owner's Business page</a></li><li><a href="#b9">Reports</a></li>
<li><a href="#b10">Money and month end</a></li><li><a href="#b11">Products (optional)</a></li><li><a href="#b12">Good habits</a></li></ol></div>

<h2 id="b1">1. Who uses Keep</h2>
<div class="card">
<ul><li><b>The owner</b> sets up services, barbers and pay, and sees money, profit and reports.</li>
<li><b>Front desk</b> (optional) has a phone login to record clients and payments. A barber who records their own clients can also have one.</li>
<li><b>Barbers don't need a login.</b> They are just a list of names, each with how they are paid.</li></ul>
<h3>Open and sign in</h3>
<p>Open keep.co.tz in Chrome (Android) or Safari (iPhone) and tap <span class="k">📲 Install</span> so Keep opens like an app. Sign in with your phone number or email and your PIN. On a computer, the menu is on the left.</p>
</div>
<div class="tip">📵 <b>No internet?</b> Keep keeps working. Clients are saved on the phone and sent when the internet returns.</div>

<h2 id="b2">2. Setting up (first day) ${BO.en}</h2>
<div class="card">
<p>The Business page shows <b>🚀 Set up your barbershop</b> with three steps. It disappears when all three are done.</p>
<h3>Step 1 — Services and prices</h3>
<ul><li>Go to <span class="k">✂️ Services</span> → <span class="k">➕ ADD SERVICE</span>.</li>
<li>Choose an icon, type the name (e.g. Haircut) and the price (e.g. 10,000).</li>
<li><b>Barber gets from each one</b> — what the barber earns every time they do this service (e.g. 2,000). Keep shows what you keep (8,000). Type 0 if barbers on this service are not paid per service.</li></ul>
<h3>Step 2 — Barbers and how they are paid</h3>
<ul><li>Go to <span class="k">👥 Barbers</span> → <span class="k">➕ ADD BARBER</span>. Type the name, then choose the pay method and how often (see section 5).</li>
<li>To change it later tap <span class="k">💵 Pay method</span> on the barber's card. Tap ✏️ to change the name, add a phone number or remove the barber.</li></ul>
<h3>Step 3 — Front desk logins (optional)</h3>
<ul><li>Menu → <span class="k">⚙️ Settings</span> → <span class="k">📱 Logins</span> → <span class="k">➕ ADD A PHONE LOGIN</span>. Keep gives you a setup code to send them on WhatsApp.</li>
<li>In <span class="k">🔐 Permissions</span> switch on what front desk may do: <b>Expenses</b> (needed to pay barbers from the drawer), <b>Cancel a client (mistakes)</b> and <b>Close the day</b>.</li></ul>
</div>

<h2 id="b3">3. Recording a client ${BF.en}</h2>
<div class="card"><ol>
<li>On <span class="k">💈 Today</span>, tap the services the client had — e.g. Haircut <b>and</b> Shave. Each one gets a ✓.</li>
<li>Tap <span class="k">Next →</span> at the bottom.</li>
<li>Choose <b>who did it</b>. If another barber did one of the services, tap their name on that line (<b>change</b>) and pick the right one.</li>
<li>Choose how the client paid: <span class="k">💵 Cash</span>, <span class="k">📱 Mobile money</span>, or <span class="k">💵 + 📱 Cash + Mobile</span> (type the cash part, the rest is mobile).</li>
<li>Check the summary and tap <span class="k">✅ CONFIRM</span>. Nothing is saved until you confirm — tap <b>← Back</b> to fix anything.</li></ol>
<p>The client appears under <b>Clients today</b> with the time, services, barber and how they paid.</p></div>
<div class="tip">💡 Need another service for the same client? Tap <span class="k">➕ Add another service</span> before paying. Price different today? Tap ✏️ next to the price.</div>

<h2 id="b4">4. Mistakes and changes</h2>
<div class="card">
<ul><li><b>Before confirming</b>: tap ✕ to remove a service, ✏️ to change a price, or <b>change</b> to switch the barber.</li>
<li><b>After confirming</b>: tap <span class="k">↩️</span> next to the client under <b>Clients today</b> → <b>Cancel client</b>. The money goes back the way it was paid, the barber's share comes off, and any product goes back on the shelf. The client stays in the list crossed out, so nothing disappears.</li>
<li>${BF.en} Front desk can cancel today's clients only, and only if the owner allowed it. ${BO.en} The owner can also cancel older visits from the day's history (🔍 Find date).</li></ul></div>

<h2 id="b5">5. How barbers are paid</h2>
<div class="card">
<p>Each barber has <b>one pay method</b> and <b>how often</b> they are paid.</p>
<h3>Pay methods</h3>
<ul><li><b>Per service</b> — earns the "barber gets" amount set on each service. Haircut 10,000 with barber gets 2,000 → 2,000 per haircut.</li>
<li><b>Percentage</b> — earns a % of the money they bring in. 40% of 50,000 → 20,000.</li>
<li><b>Chair rent</b> — keeps the money they bring in and pays the shop a rent for each day they work. 50,000 brought in, rent 10,000 → 40,000 to them.</li>
<li><b>Salary</b> — a fixed monthly amount. Keep still counts their clients.</li></ul>
<h3>How often</h3>
<ul><li><b>Daily</b> — paid at the end of every day. Front desk pays them before ending the shift or closing the day.</li>
<li><b>Weekly</b> or <b>Monthly</b> — the owner pays them. Keep reminds the owner when it is due.</li>
<li><b>Salary</b> is always paid by the owner, once a month.</li></ul>
<div class="tip">💡 Changing a service's "barber gets" amount only changes future clients. Clients already recorded keep the amount they had.</div></div>

<h2 id="b6">6. Paying barbers</h2>
<div class="card">
<h3>Daily barbers ${BF.en}</h3>
<ul><li>Tap <span class="k">💵 Pay barbers</span> on Today at any time — it lists each daily barber with clients, earned, paid and <b>to pay</b>.</li>
<li>Tap <span class="k">💵 Cash</span> or <span class="k">📱 Mobile</span> and confirm. Payment from cash comes off the drawer, so your cash count still adds up.</li>
<li>If a service has no "barber gets" amount, Keep shows a yellow warning — the owner should set it in Services.</li></ul>
<h3>Weekly, monthly and salary ${BO.en}</h3>
<ul><li>When pay is due, the Business page shows a red <b>💵 Barber pay due</b> card and the Barbers tab shows a number. Tap <span class="k">Pay</span>.</li>
<li>Weekly: due 7 days after the last payment. Monthly and salary: due from the last day of the month.</li>
<li>Any time: <span class="k">👥 Barbers</span> → <span class="k">💵 PAY</span> shows each barber's clients, money, share, paid and owed for the dates you choose. Salaries show under <b>This month</b>.</li></ul></div>

<h2 id="b7">7. Ending a shift and closing the day</h2>
<div class="card">
<h3>End shift ${BF.en}</h3>
<ol><li>Tap <span class="k">🔒 END SHIFT</span>. First Keep shows <b>Pay barbers for today</b> — pay every daily barber, then tap <b>Continue</b>.</li>
<li>Count all the cash in the drawer and type it. Add the Lipa kwa Simu balance if you can see it.</li>
<li>If you are the last one and the owner allows it, tick <b>close the day</b>. Submit.</li></ol>
<h3>Close day ${BO.en}</h3>
<p>Menu → <span class="k">🔒 Close day</span>. Daily barbers must be paid first. Review any cash-ups, then close and send the summary on WhatsApp.</p></div>

<h2 id="b8">8. The owner's Business page ${BO.en}</h2>
<div class="card">
<ul><li><b>Today's money</b>, cash, mobile, bank and savings balances, and <b>profit so far</b> this month.</li>
<li><b>Barbers today</b> — each barber's clients, money and their share, and what <b>you keep</b>.</li>
<li><b>Barber pay due</b> — weekly, monthly and salary payments that are due.</li>
<li><b>Days</b> — every day of the month; tap a day for the detail.</li></ul>
<div class="tip">💡 <b>Profit</b> = money in − what barbers earned − other expenses. Paying a barber what they earned is not counted twice. A salary counts as an expense when you pay it.</div></div>

<h2 id="b9">9. Reports ${BO.en}</h2>
<div class="card">
<p>Menu → <span class="k">📄 Reports</span>. Choose the dates, then PDF or Excel.</p>
<ul><li><b>Clients list</b> — every client with services, barber and payment.</li>
<li><b>By service</b> — how many of each service and the money.</li>
<li><b>Daily summary</b> — money, cash and mobile per day. <b>Cancelled</b> — cancelled clients and refunds.</li>
<li><b>Profit &amp; loss</b> — money in, barbers earned, supplies, expenses and profit.</li>
<li><b>Expenses</b>, <b>Banking</b> and <b>Cash-ups</b>.</li></ul></div>

<h2 id="b10">10. Money and month end ${BO.en}</h2>
<div class="card">
<ul><li><span class="k">📒 Accounting</span> — record expenses (LUKU, rent, supplies like blades), money into or out of the bank, transfers and savings, or correct a balance.</li>
<li><span class="k">📅 Monthly profit</span> — see each month and close it, moving part of the profit into savings.</li></ul></div>

<h2 id="b11">11. Products (optional) ${BO.en}</h2>
<div class="card">
<p>If you also sell things like hair oil: <span class="k">✂️ Services</span> → <span class="k">➕ ADD A PRODUCT</span> with name, price, cost and how many you have. Products appear under services on Today and are recorded the same way; Keep takes them off stock.</p></div>

<h2 id="b12">12. Good habits</h2>
<div class="card"><ul>
<li>Record every client before they leave — don't wait till evening.</li>
<li>Set "barber gets" on every service before the first client.</li>
<li>Pay daily barbers every day before closing, and check the red reminder for the others.</li>
<li>Keep the phone's date and time on <b>automatic</b>.</li>
<li>Switch off a front-desk login on the day that person leaves.</li></ul></div>
${contactBox.en}`,

sw: () => `
<h1>Jinsi ya kutumia Keep kwenye kinyozi</h1>
<p class="lead">Mwongozo kwa mmiliki wa kinyozi na mapokezi. Alama kama ${BO.sw} au ${BF.sw} zinaonyesha nani hufanya kila hatua. Mmiliki anaweza kufanya kila kitu.</p>
<div class="toc"><ol>
<li><a href="#b1">Nani anatumia Keep</a></li><li><a href="#b2">Kuandaa (siku ya kwanza)</a></li><li><a href="#b3">Kurekodi mteja</a></li>
<li><a href="#b4">Makosa na mabadiliko</a></li><li><a href="#b5">Jinsi vinyozi wanavyolipwa</a></li><li><a href="#b6">Kulipa vinyozi</a></li>
<li><a href="#b7">Kumaliza zamu na kufunga siku</a></li><li><a href="#b8">Ukurasa wa Biashara wa mmiliki</a></li><li><a href="#b9">Ripoti</a></li>
<li><a href="#b10">Pesa na mwisho wa mwezi</a></li><li><a href="#b11">Bidhaa (si lazima)</a></li><li><a href="#b12">Tabia nzuri</a></li></ol></div>

<h2 id="b1">1. Nani anatumia Keep</h2>
<div class="card">
<ul><li><b>Mmiliki</b> anaweka huduma, vinyozi na malipo, na anaona pesa, faida na ripoti.</li>
<li><b>Mapokezi</b> (si lazima) wana akaunti ya simu ya kurekodi wateja na malipo. Kinyozi anayerekodi wateja wake mwenyewe anaweza pia kuwa nayo.</li>
<li><b>Vinyozi hawahitaji akaunti.</b> Ni orodha ya majina tu, kila mmoja na jinsi anavyolipwa.</li></ul>
<h3>Kufungua na kuingia</h3>
<p>Fungua keep.co.tz kwenye Chrome (Android) au Safari (iPhone) na ubonyeze <span class="k">📲 Install</span> ili Keep ifunguke kama app. Ingia kwa namba ya simu au barua pepe na PIN yako. Kwenye kompyuta, menyu iko upande wa kushoto.</p>
</div>
<div class="tip">📵 <b>Hakuna intaneti?</b> Keep inaendelea kufanya kazi. Wateja wanahifadhiwa kwenye simu na kutumwa intaneti ikirudi.</div>

<h2 id="b2">2. Kuandaa (siku ya kwanza) ${BO.sw}</h2>
<div class="card">
<p>Ukurasa wa Biashara unaonyesha <b>🚀 Andaa kinyozi chako</b> wenye hatua tatu. Unapotea hatua zote zikikamilika.</p>
<h3>Hatua 1 — Huduma na bei</h3>
<ul><li>Nenda <span class="k">✂️ Huduma</span> → <span class="k">➕ ONGEZA HUDUMA</span>.</li>
<li>Chagua alama, andika jina (mfano Kunyoa) na bei (mfano 10,000).</li>
<li><b>Kinyozi anapata kwa kila moja</b> — anachopata kinyozi kila anapofanya huduma hii (mfano 2,000). Keep inaonyesha unachobaki nacho (8,000). Andika 0 kama vinyozi wa huduma hii hawalipwi kwa kila huduma.</li></ul>
<h3>Hatua 2 — Vinyozi na jinsi wanavyolipwa</h3>
<ul><li>Nenda <span class="k">👥 Vinyozi</span> → <span class="k">➕ ONGEZA KINYOZI</span>. Andika jina, kisha chagua njia ya malipo na mara ngapi (angalia sehemu 5).</li>
<li>Kubadilisha baadaye bonyeza <span class="k">💵 Njia ya malipo</span> kwenye kadi ya kinyozi. Bonyeza ✏️ kubadilisha jina, kuongeza namba ya simu au kumwondoa.</li></ul>
<h3>Hatua 3 — Akaunti za mapokezi (si lazima)</h3>
<ul><li>Menyu → <span class="k">⚙️ Mipangilio</span> → <span class="k">📱 Akaunti</span> → <span class="k">➕ ONGEZA AKAUNTI YA SIMU</span>. Keep inakupa namba ya kuandaa ya kumtumia kwa WhatsApp.</li>
<li>Kwenye <span class="k">🔐 Ruhusa</span> washa kile mapokezi wanaruhusiwa: <b>Matumizi</b> (inahitajika kulipa vinyozi kutoka droo), <b>Futa mteja (makosa)</b> na <b>Kufunga siku</b>.</li></ul>
</div>

<h2 id="b3">3. Kurekodi mteja ${BF.sw}</h2>
<div class="card"><ol>
<li>Kwenye <span class="k">💈 Leo</span>, gusa huduma alizopata mteja — mfano Kunyoa <b>na</b> Ndevu. Kila moja inapata ✓.</li>
<li>Bonyeza <span class="k">Endelea →</span> chini.</li>
<li>Chagua <b>nani alifanya</b>. Kama kinyozi mwingine alifanya huduma moja, gusa jina lake kwenye mstari huo (<b>badilisha</b>) uchague sahihi.</li>
<li>Chagua jinsi mteja alivyolipa: <span class="k">💵 Taslimu</span>, <span class="k">📱 Pesa za simu</span>, au <span class="k">💵 + 📱 Taslimu + Simu</span> (andika sehemu ya taslimu, inayobaki ni simu).</li>
<li>Hakiki muhtasari na ubonyeze <span class="k">✅ THIBITISHA</span>. Hakuna kinachohifadhiwa hadi uthibitishe — bonyeza <b>← Rudi</b> kurekebisha.</li></ol>
<p>Mteja anaonekana chini ya <b>Wateja leo</b> na saa, huduma, kinyozi na jinsi alivyolipa.</p></div>
<div class="tip">💡 Mteja anahitaji huduma nyingine? Bonyeza <span class="k">➕ Ongeza huduma nyingine</span> kabla ya kulipa. Bei tofauti leo? Bonyeza ✏️ karibu na bei.</div>

<h2 id="b4">4. Makosa na mabadiliko</h2>
<div class="card">
<ul><li><b>Kabla ya kuthibitisha</b>: bonyeza ✕ kuondoa huduma, ✏️ kubadilisha bei, au <b>badilisha</b> kubadilisha kinyozi.</li>
<li><b>Baada ya kuthibitisha</b>: bonyeza <span class="k">↩️</span> karibu na mteja chini ya <b>Wateja leo</b> → <b>Futa mteja</b>. Pesa inarudishwa kama ilivyolipwa, sehemu ya kinyozi inaondolewa, na bidhaa yoyote inarudi kwenye rafu. Mteja anabaki kwenye orodha amekatwa mstari, hivyo hakuna kinachopotea.</li>
<li>${BF.sw} Mapokezi wanaweza kufuta wateja wa leo tu, na kama mmiliki ameruhusu. ${BO.sw} Mmiliki anaweza pia kufuta ziara za zamani kupitia historia ya siku (🔍 Tafuta tarehe).</li></ul></div>

<h2 id="b5">5. Jinsi vinyozi wanavyolipwa</h2>
<div class="card">
<p>Kila kinyozi ana <b>njia moja ya malipo</b> na <b>mara ngapi</b> analipwa.</p>
<h3>Njia za malipo</h3>
<ul><li><b>Kwa kila huduma</b> — anapata kiasi cha "kinyozi anapata" kilichowekwa kwenye kila huduma. Kunyoa 10,000 na kinyozi anapata 2,000 → 2,000 kwa kila kunyoa.</li>
<li><b>Asilimia</b> — anapata % ya pesa anazoleta. 40% ya 50,000 → 20,000.</li>
<li><b>Kodi ya kiti</b> — anabaki na pesa anazoleta na analipa duka kodi kwa kila siku anayofanya kazi. Ameleta 50,000, kodi 10,000 → 40,000 kwake.</li>
<li><b>Mshahara</b> — kiasi maalum kwa mwezi. Keep bado inahesabu wateja wake.</li></ul>
<h3>Mara ngapi</h3>
<ul><li><b>Kila siku</b> — analipwa mwisho wa kila siku. Mapokezi wanamlipa kabla ya kumaliza zamu au kufunga siku.</li>
<li><b>Kila wiki</b> au <b>Kila mwezi</b> — mmiliki anamlipa. Keep inamkumbusha mmiliki muda ukifika.</li>
<li><b>Mshahara</b> unalipwa na mmiliki kila mara, mara moja kwa mwezi.</li></ul>
<div class="tip">💡 Kubadilisha "kinyozi anapata" kwenye huduma kunabadilisha wateja wajao tu. Wateja waliorekodiwa wanabaki na kiasi walichokuwa nacho.</div></div>

<h2 id="b6">6. Kulipa vinyozi</h2>
<div class="card">
<h3>Vinyozi wa kila siku ${BF.sw}</h3>
<ul><li>Bonyeza <span class="k">💵 Lipa vinyozi</span> kwenye Leo wakati wowote — inaonyesha kila kinyozi wa kila siku na wateja, alichopata, alicholipwa na <b>kulipa</b>.</li>
<li>Bonyeza <span class="k">💵 Taslimu</span> au <span class="k">📱 Simu</span> na uthibitishe. Malipo ya taslimu yanatolewa kwenye droo, hivyo hesabu yako ya droo inalingana.</li>
<li>Huduma isiyo na kiasi cha "kinyozi anapata" inaonyesha onyo la njano — mmiliki aiweke kwenye Huduma.</li></ul>
<h3>Wiki, mwezi na mshahara ${BO.sw}</h3>
<ul><li>Malipo yakifika, ukurasa wa Biashara unaonyesha kadi nyekundu <b>💵 Malipo ya vinyozi yamefika</b> na kitufe cha Vinyozi kinaonyesha namba. Bonyeza <span class="k">Lipa</span>.</li>
<li>Wiki: inafika siku 7 baada ya malipo ya mwisho. Mwezi na mshahara: inafika kuanzia siku ya mwisho ya mwezi.</li>
<li>Wakati wowote: <span class="k">👥 Vinyozi</span> → <span class="k">💵 LIPA</span> inaonyesha wateja, pesa, sehemu, alicholipwa na anachodai kwa tarehe unazochagua. Mishahara inaonekana chini ya <b>Mwezi huu</b>.</li></ul></div>

<h2 id="b7">7. Kumaliza zamu na kufunga siku</h2>
<div class="card">
<h3>Maliza zamu ${BF.sw}</h3>
<ol><li>Bonyeza <span class="k">🔒 MALIZA ZAMU</span>. Kwanza Keep inaonyesha <b>Lipa vinyozi wa leo</b> — mlipe kila kinyozi wa kila siku, kisha bonyeza <b>Endelea</b>.</li>
<li>Hesabu pesa zote kwenye droo na uandike. Ongeza salio la Lipa kwa Simu kama unaliona.</li>
<li>Kama wewe ni wa mwisho na mmiliki ameruhusu, weka alama <b>funga siku</b>. Wasilisha.</li></ol>
<h3>Funga siku ${BO.sw}</h3>
<p>Menyu → <span class="k">🔒 Funga siku</span>. Vinyozi wa kila siku lazima walipwe kwanza. Kagua hesabu za droo, kisha funga na utume muhtasari kwa WhatsApp.</p></div>

<h2 id="b8">8. Ukurasa wa Biashara wa mmiliki ${BO.sw}</h2>
<div class="card">
<ul><li><b>Pesa za leo</b>, salio la taslimu, simu, benki na akiba, na <b>faida mpaka sasa</b> mwezi huu.</li>
<li><b>Vinyozi leo</b> — wateja, pesa na sehemu ya kila kinyozi, na <b>unachobaki nacho</b>.</li>
<li><b>Malipo ya vinyozi yamefika</b> — malipo ya wiki, mwezi na mshahara yaliyofika.</li>
<li><b>Siku</b> — kila siku ya mwezi; gusa siku kuona taarifa zake.</li></ul>
<div class="tip">💡 <b>Faida</b> = pesa zilizoingia − walichopata vinyozi − matumizi mengine. Kumlipa kinyozi alichopata hakuhesabiwi mara mbili. Mshahara unahesabiwa kama matumizi unapoulipa.</div></div>

<h2 id="b9">9. Ripoti ${BO.sw}</h2>
<div class="card">
<p>Menyu → <span class="k">📄 Ripoti</span>. Chagua tarehe, kisha PDF au Excel.</p>
<ul><li><b>Orodha ya wateja</b> — kila mteja na huduma, kinyozi na malipo.</li>
<li><b>Kwa huduma</b> — idadi ya kila huduma na pesa.</li>
<li><b>Muhtasari wa kila siku</b> — pesa, taslimu na simu kwa siku. <b>Zilizofutwa</b> — wateja waliofutwa na marejesho.</li>
<li><b>Faida na hasara</b> — pesa zilizoingia, walichopata vinyozi, vifaa, matumizi na faida.</li>
<li><b>Matumizi</b>, <b>Benki</b> na <b>Hesabu za droo</b>.</li></ul></div>

<h2 id="b10">10. Pesa na mwisho wa mwezi ${BO.sw}</h2>
<div class="card">
<ul><li><span class="k">📒 Hesabu</span> — rekodi matumizi (LUKU, kodi ya pango, vifaa kama wembe), pesa kuingia au kutoka benki, uhamisho na akiba, au rekebisha salio.</li>
<li><span class="k">📅 Faida ya mwezi</span> — ona kila mwezi na uufunge, ukihamisha sehemu ya faida kwenda akiba.</li></ul></div>

<h2 id="b11">11. Bidhaa (si lazima) ${BO.sw}</h2>
<div class="card">
<p>Kama unauza pia vitu kama mafuta ya nywele: <span class="k">✂️ Huduma</span> → <span class="k">➕ ONGEZA BIDHAA</span> na jina, bei, gharama na idadi uliyonayo. Bidhaa zinaonekana chini ya huduma kwenye Leo na zinarekodiwa vivyo hivyo; Keep inazitoa kwenye stoku.</p></div>

<h2 id="b12">12. Tabia nzuri</h2>
<div class="card"><ul>
<li>Rekodi kila mteja kabla hajaondoka — usisubiri jioni.</li>
<li>Weka "kinyozi anapata" kwenye kila huduma kabla ya mteja wa kwanza.</li>
<li>Walipe vinyozi wa kila siku kila siku kabla ya kufunga, na angalia kikumbusho chekundu kwa wengine.</li>
<li>Weka tarehe na saa ya simu kuwa <b>automatic</b>.</li>
<li>Zima akaunti ya mapokezi siku mtu huyo anaondoka.</li></ul></div>
${contactBox.sw}`
},

faq: {
en: () => `
<h1>Barbershop questions</h1>
<p class="lead">Quick answers for barbershops. Can't find yours? Contact Keep support at the bottom.</p>
${faqList([
['Do barbers need a login?', 'No. Barbers are a list of names with a pay method. Only whoever records clients on a phone needs a login (front desk, or a barber with their own phone).'],
['A client had two services from two barbers.', 'Tick both services, tap Next, choose the first barber, then on the pay screen tap "change" under the other service and pick the second barber.'],
['I recorded the wrong client.', 'Under Clients today tap ↩️ next to the client and confirm. The money goes back the way it was paid and the barber\'s share comes off. Front desk needs the owner\'s permission "Cancel a client (mistakes)".'],
['Pay barbers says "no barber gets amount".', 'The service has no "barber gets" amount. The owner opens Services, taps the service and fills in "Barber gets from each one". Today\'s clients then count with that amount.'],
['Why can\'t I end my shift?', 'Daily barbers must be paid first. Tap Pay barbers, pay each one, then end the shift. If you can\'t pay from the drawer, the owner must switch on Expenses for front desk.'],
['A barber gets a percentage, not a fixed amount.', 'Barbers → tap Pay method on their card → Percentage → type the % → choose how often. The "barber gets" amount on services is then ignored for that barber.'],
['How do I pay a salary?', 'At the end of the month the Business page shows "Barber pay due" with the salary. Tap Pay, choose cash, mobile or bank. Or Barbers → PAY → This month.'],
['Why is my profit lower than the money in?', 'Profit takes off what the barbers earned and your other expenses (rent, LUKU, supplies). Business → Monthly profit shows each part.'],
['Can I sell products too?', 'Yes. Services → Add a product. Products show under services on Today and Keep counts their stock.'],
['Does Keep work without internet?', 'Yes. Keep records clients on the phone and sends them when the internet returns. Paying barbers and reports need internet.']
])}
${contactBox.en}`,
sw: () => `
<h1>Maswali ya kinyozi</h1>
<p class="lead">Majibu ya haraka kwa vinyozi. Hupati jibu lako? Wasiliana na huduma ya Keep hapo chini.</p>
${faqList([
['Je, vinyozi wanahitaji akaunti?', 'Hapana. Vinyozi ni orodha ya majina na njia ya malipo. Anayerekodi wateja kwenye simu tu ndiye anahitaji akaunti (mapokezi, au kinyozi mwenye simu yake).'],
['Mteja alipata huduma mbili kutoka vinyozi wawili.', 'Weka alama huduma zote mbili, bonyeza Endelea, chagua kinyozi wa kwanza, kisha kwenye skrini ya malipo gusa "badilisha" chini ya huduma nyingine uchague kinyozi wa pili.'],
['Nimerekodi mteja kimakosa.', 'Chini ya Wateja leo bonyeza ↩️ karibu na mteja na uthibitishe. Pesa inarudishwa kama ilivyolipwa na sehemu ya kinyozi inaondolewa. Mapokezi wanahitaji ruhusa ya mmiliki "Futa mteja (makosa)".'],
['Lipa vinyozi inasema "hakuna kiasi cha kinyozi anapata".', 'Huduma haina kiasi cha "kinyozi anapata". Mmiliki afungue Huduma, agusa huduma hiyo na ajaze "Kinyozi anapata kwa kila moja". Wateja wa leo wanahesabiwa kwa kiasi hicho.'],
['Kwa nini siwezi kumaliza zamu?', 'Vinyozi wa kila siku lazima walipwe kwanza. Bonyeza Lipa vinyozi, mlipe kila mmoja, kisha maliza zamu. Kama huwezi kulipa kutoka droo, mmiliki lazima awashe Matumizi kwa mapokezi.'],
['Kinyozi analipwa asilimia, si kiasi maalum.', 'Vinyozi → bonyeza Njia ya malipo kwenye kadi yake → Asilimia → andika % → chagua mara ngapi. Kiasi cha "kinyozi anapata" kwenye huduma hakitumiki kwa kinyozi huyo.'],
['Nalipaje mshahara?', 'Mwisho wa mwezi ukurasa wa Biashara unaonyesha "Malipo ya vinyozi yamefika" na mshahara. Bonyeza Lipa, chagua taslimu, simu au benki. Au Vinyozi → LIPA → Mwezi huu.'],
['Kwa nini faida iko chini kuliko pesa zilizoingia?', 'Faida inatoa walichopata vinyozi na matumizi yako mengine (kodi ya pango, LUKU, vifaa). Biashara → Faida ya mwezi inaonyesha kila sehemu.'],
['Naweza kuuza bidhaa pia?', 'Ndiyo. Huduma → Ongeza bidhaa. Bidhaa zinaonekana chini ya huduma kwenye Leo na Keep inahesabu stoku yake.'],
['Je, Keep inafanya kazi bila intaneti?', 'Ndiyo. Keep inarekodi wateja kwenye simu na kuwatuma intaneti ikirudi. Kulipa vinyozi na ripoti zinahitaji intaneti.']
])}
${contactBox.sw}`
}
};
