(function () {
  "use strict";

  var STORAGE_KEY = "flip7-scorekeeper-state-v2";
  var ACCENTS = [
    "#FFC53D",
    "#FF6B5E",
    "#2FD9C4",
    "#9C7FE6",
    "#FF4F81",
    "#5EA1FF",
    "#7CDB6A",
  ];

  var state = loadState() || {
    players: [], // {id, name, wins, lifetimePoints}
    rounds: [], // [{playerId: {score, bust, bonus}}]
    targetScore: 200,
    gameOver: false,
    winnerId: null,
  };
  state.players.forEach(function (p) {
    if (typeof p.lifetimePoints !== "number") p.lifetimePoints = 0;
  });

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }
  function accentFor(index) {
    return ACCENTS[index % ACCENTS.length];
  }

  function totalFor(playerId) {
    var sum = 0;
    state.rounds.forEach(function (r) {
      var entry = r[playerId];
      if (entry) sum += entry.score;
    });
    return sum;
  }

  function checkWinner() {
    if (state.players.length === 0) return;
    var qualifying = state.players.filter(function (p) {
      return totalFor(p.id) >= state.targetScore;
    });
    if (qualifying.length === 0) {
      state.gameOver = false;
      state.winnerId = null;
      return;
    }
    qualifying.sort(function (a, b) {
      return totalFor(b.id) - totalFor(a.id);
    });
    state.gameOver = true;
    state.winnerId = qualifying[0].id;
  }

  function addPlayer(name) {
    name = name.trim();
    if (!name) return;
    state.players.push({
      id: uid(),
      name: name,
      wins: 0,
      lifetimePoints: 0,
    });
    saveState();
    render();
  }

  function removePlayer(id) {
    state.players = state.players.filter(function (p) {
      return p.id !== id;
    });
    state.rounds.forEach(function (r) {
      delete r[id];
    });
    if (state.winnerId === id) {
      state.winnerId = null;
      state.gameOver = false;
    }
    saveState();
    render();
  }

  function addRound() {
    if (state.players.length === 0 || state.gameOver) return;
    var entry = {};
    var anyFilled = false;
    state.players.forEach(function (p) {
      var numInput = document.getElementById("num-" + p.id);
      var bustInput = document.getElementById("bust-" + p.id);
      var bonusInput = document.getElementById("bonus-" + p.id);
      var bust = bustInput && bustInput.checked;
      var bonus = bonusInput && bonusInput.checked;
      var raw = numInput ? numInput.value : "";
      var val = bust ? 0 : parseInt(raw, 10) || 0;
      if (bonus) val += 15;
      if (raw !== "" || bust || bonus) anyFilled = true;
      entry[p.id] = { score: val, bust: !!bust, bonus: !!bonus };
    });
    if (!anyFilled) return;
    state.rounds.push(entry);

    state.players.forEach(function (p) {
      var e = entry[p.id];
      if (e) p.lifetimePoints += e.score;
    });

    checkWinner();
    if (state.gameOver) {
      var winner = state.players.find(function (p) {
        return p.id === state.winnerId;
      });
      if (winner) winner.wins += 1;
    }
    saveState();
    render();
  }

  function undoLastRound() {
    if (state.rounds.length === 0) return;
    var last = state.rounds.pop();
    state.players.forEach(function (p) {
      var e = last[p.id];
      if (e) p.lifetimePoints -= e.score;
    });
    if (state.gameOver && state.winnerId) {
      var winner = state.players.find(function (p) {
        return p.id === state.winnerId;
      });
      checkWinner();
      if (winner && !state.gameOver) {
        winner.wins = Math.max(0, winner.wins - 1);
      }
    } else {
      checkWinner();
    }
    saveState();
    render();
  }

  function newGame() {
    state.rounds = [];
    state.gameOver = false;
    state.winnerId = null;
    saveState();
    render();
  }

  function resetAll() {
    state = {
      players: [],
      rounds: [],
      targetScore: 200,
      gameOver: false,
      winnerId: null,
    };
    saveState();
    closeModal();
    render();
  }

  function render() {
    document.getElementById("targetInput").value = state.targetScore;

    renderRoster();
    renderWinnerBanner();
    renderTable();
    renderRoundPanel();

    var endNightBtn = document.getElementById("endNightBtn");
    endNightBtn.disabled = state.players.length === 0;
    endNightBtn.style.opacity = state.players.length === 0 ? 0.45 : 1;
  }

  function renderRoster() {
    var host = document.getElementById("rosterList");
    host.innerHTML = "";
    if (state.players.length === 0) {
      host.innerHTML =
        '<div class="roster-empty">No players yet — add names above to start a game.</div>';
      return;
    }
    state.players.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "roster-item";
      row.style.setProperty("--accent", accentFor(i));
      row.innerHTML =
        '<div class="name">' +
        escapeHtml(p.name) +
        "</div>" +
        '<div class="wins">🏆 <b>' +
        p.wins +
        "</b> win" +
        (p.wins === 1 ? "" : "s") +
        "</div>" +
        '<button class="remove" title="Remove player" data-id="' +
        p.id +
        '">&times;</button>';
      row.querySelector(".remove").addEventListener("click", function () {
        removePlayer(p.id);
      });
      host.appendChild(row);
    });
  }

  function renderWinnerBanner() {
    var host = document.getElementById("winnerBannerHost");
    host.innerHTML = "";
    if (!state.gameOver || !state.winnerId) return;
    var winner = state.players.find(function (p) {
      return p.id === state.winnerId;
    });
    if (!winner) return;
    var div = document.createElement("div");
    div.className = "winner-banner";
    div.innerHTML =
      '<div class="label">Game over</div>' +
      '<div class="name">' +
      escapeHtml(winner.name) +
      " wins!</div>" +
      '<div class="score">' +
      totalFor(winner.id) +
      " points · target was " +
      state.targetScore +
      "</div>";
    host.appendChild(div);
  }

  function renderTable() {
    var head = document.getElementById("tableHeadRow");
    var body = document.getElementById("tableBody");
    var scroll = document.querySelector(".table-scroll");

    if (state.players.length === 0) {
      scroll.style.display = "none";
      return;
    }
    scroll.style.display = "block";

    head.innerHTML = "<th>Round</th>";
    state.players.forEach(function (p, i) {
      var th = document.createElement("th");
      th.style.color = accentFor(i);
      th.textContent = p.name;
      head.appendChild(th);
    });

    body.innerHTML = "";

    if (state.rounds.length === 0) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = state.players.length + 1;
      td.className = "empty-state";
      td.textContent =
        "No rounds played yet. Enter scores below and add your first round.";
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      state.rounds.forEach(function (r, idx) {
        var tr = document.createElement("tr");
        tr.className = "round-row";
        var first = document.createElement("td");
        first.textContent = "Round " + (idx + 1);
        tr.appendChild(first);
        state.players.forEach(function (p) {
          var td = document.createElement("td");
          var e = r[p.id] || { score: 0, bust: false, bonus: false };
          var html = String(e.score);
          if (e.bust) html += '<span class="bust-tag">bust</span>';
          if (e.bonus) html += '<span class="bonus-tag">+15 flip7</span>';
          td.innerHTML = html;
          tr.appendChild(td);
        });
        body.appendChild(tr);
      });
    }

    var totalTr = document.createElement("tr");
    totalTr.className = "total-row";
    var totalLabel = document.createElement("td");
    totalLabel.textContent = "Total";
    totalTr.appendChild(totalLabel);

    var totals = state.players.map(function (p) {
      return totalFor(p.id);
    });
    var maxTotal = Math.max.apply(null, totals.concat([0]));

    state.players.forEach(function (p, i) {
      var td = document.createElement("td");
      var t = totals[i];
      td.textContent = t;
      if (t === maxTotal && maxTotal > 0) td.classList.add("leader");
      totalTr.appendChild(td);
    });
    body.appendChild(totalTr);
  }

  function renderRoundPanel() {
    var panel = document.getElementById("roundPanel");
    if (state.players.length === 0) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";

    var addBtn = document.getElementById("addRoundBtn");
    var undoBtn = document.getElementById("undoBtn");
    undoBtn.disabled = state.rounds.length === 0;
    undoBtn.style.opacity = state.rounds.length === 0 ? 0.4 : 1;

    if (state.gameOver) {
      document.getElementById("roundNumberLabel").textContent = "next game";
      addBtn.textContent = "Start a new game to continue";
      addBtn.disabled = false;
      addBtn.style.opacity = 1;
    } else {
      document.getElementById("roundNumberLabel").textContent =
        "round " + (state.rounds.length + 1);
      addBtn.textContent = "Add round";
      addBtn.disabled = false;
      addBtn.style.opacity = 1;
    }

    var host = document.getElementById("roundInputs");
    host.innerHTML = "";
    state.players.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "player-input-row";
      row.innerHTML =
        '<div class="pname"><span class="swatch" style="background:' +
        accentFor(i) +
        '"></span>' +
        escapeHtml(p.name) +
        "</div>" +
        '<label class="toggle" id="bustLabel-' +
        p.id +
        '"><input type="checkbox" id="bust-' +
        p.id +
        '" />Bust</label>' +
        '<label class="toggle" id="bonusLabel-' +
        p.id +
        '"><input type="checkbox" id="bonus-' +
        p.id +
        '" />+15</label>' +
        '<input type="number" id="num-' +
        p.id +
        '" placeholder="0" min="0" ' +
        (state.gameOver ? "disabled" : "") +
        " />";
      host.appendChild(row);
    });

    state.players.forEach(function (p) {
      var bustBox = document.getElementById("bust-" + p.id);
      var bonusBox = document.getElementById("bonus-" + p.id);
      var numInput = document.getElementById("num-" + p.id);
      var bustLabel = document.getElementById("bustLabel-" + p.id);
      var bonusLabel = document.getElementById("bonusLabel-" + p.id);

      bustBox.addEventListener("change", function () {
        numInput.disabled = bustBox.checked || state.gameOver;
        if (bustBox.checked) {
          numInput.value = "";
          bonusBox.checked = false;
          bonusLabel.classList.remove("active-bonus");
        }
        bustLabel.classList.toggle("active-bust", bustBox.checked);
      });
      bonusBox.addEventListener("change", function () {
        if (bonusBox.checked) {
          bustBox.checked = false;
          numInput.disabled = state.gameOver;
          bustLabel.classList.remove("active-bust");
        }
        bonusLabel.classList.toggle("active-bonus", bonusBox.checked);
      });
    });
  }

  function computeStandings() {
    return state.players.slice().sort(function (a, b) {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.lifetimePoints - a.lifetimePoints;
    });
  }

  function openNightModal() {
    if (state.players.length === 0) return;
    var standings = computeStandings();
    var top3 = standings.slice(0, 3);

    document.getElementById("nightSubtitle").textContent =
      standings.length +
      " player" +
      (standings.length === 1 ? "" : "s") +
      " · ranked by wins, then total points";

    var podiumHost = document.getElementById("podiumHost");
    podiumHost.innerHTML = "";
    var medals = ["🥇", "🥈", "🥉"];
    top3.forEach(function (p, i) {
      var slot = document.createElement("div");
      slot.className = "podium-slot rank-" + (i + 1);
      slot.innerHTML =
        '<div class="podium-medal">' +
        medals[i] +
        "</div>" +
        '<div class="podium-name">' +
        escapeHtml(p.name) +
        "</div>" +
        '<div class="podium-stat">' +
        p.wins +
        " win" +
        (p.wins === 1 ? "" : "s") +
        " · " +
        p.lifetimePoints +
        " pts</div>" +
        '<div class="podium-bar"></div>';
      podiumHost.appendChild(slot);
    });

    var listHost = document.getElementById("standingsHost");
    listHost.innerHTML = "";
    standings.forEach(function (p, i) {
      var row = document.createElement("div");
      row.className = "standings-row";
      row.innerHTML =
        '<div class="standings-rank">#' +
        (i + 1) +
        "</div>" +
        '<div class="standings-name">' +
        escapeHtml(p.name) +
        "</div>" +
        '<div class="standings-stats"><span>🏆 <b>' +
        p.wins +
        "</b></span><span>✨ <b>" +
        p.lifetimePoints +
        "</b> pts</span></div>";
      listHost.appendChild(row);
    });

    document.getElementById("nightModal").classList.add("show");
  }

  function closeModal() {
    document.getElementById("nightModal").classList.remove("show");
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  document
    .getElementById("addPlayerBtn")
    .addEventListener("click", function () {
      var input = document.getElementById("playerNameInput");
      addPlayer(input.value);
      input.value = "";
      input.focus();
    });
  document
    .getElementById("playerNameInput")
    .addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        addPlayer(this.value);
        this.value = "";
      }
    });
  document
    .getElementById("targetInput")
    .addEventListener("change", function () {
      var v = parseInt(this.value, 10);
      state.targetScore = v && v > 0 ? v : 200;
      checkWinner();
      saveState();
      render();
    });
  document.getElementById("addRoundBtn").addEventListener("click", function () {
    if (state.gameOver) {
      newGame();
    } else {
      addRound();
    }
  });
  document.getElementById("undoBtn").addEventListener("click", undoLastRound);
  document.getElementById("newGameBtn").addEventListener("click", newGame);
  document.getElementById("resetAllBtn").addEventListener("click", function () {
    if (!confirm("This clears all players, scores, and win totals. Continue?"))
      return;
    resetAll();
  });
  document
    .getElementById("endNightBtn")
    .addEventListener("click", openNightModal);
  document
    .getElementById("closeModalBtn")
    .addEventListener("click", closeModal);
  document
    .getElementById("resetFromModalBtn")
    .addEventListener("click", function () {
      if (
        !confirm("This clears all players, scores, and win totals. Continue?")
      )
        return;
      resetAll();
    });
  document.getElementById("nightModal").addEventListener("click", function (e) {
    if (e.target === this) closeModal();
  });

  render();
})();
