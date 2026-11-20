/*
 * Minesweeper Classic, a Microsoft Minesweeper clone for the browser
 * Copyright (c) 2015-2024 Brandon Dusseau
 * Licensed with the MIT license; see LICENSE file for details
 *
 * http://www.github.com/BrandonDusseau/minesweeper-classic
 */

(function ()
{
	/*****************************************************
	 * Initialization
	 *****************************************************/

	// Check that the required environment is present
	if (typeof window.SweeperOSEnvironment == "undefined")
	{
		console.log("Sweeper OS envrionment is unavailable. Minesweeper cannot run.");
		return;
	}

	// Get the environment
	var env = window.SweeperOSEnvironment;

	var timer        = null;  // Interval timer to handle clock
	var time         = 0;     // Time elapsed in game
	var timerEnabled = true;  // True to enable the game timer
	var gameWaiting  = true;  // Whether game is waiting to start
	var noMoves      = true;  // Whether no moves have been made yet
	var gameOver     = false; // Whether the game has ended (win or explode)
	var minesLeft    = 0;     // Number of mines unflagged. from the user perspective
	var maxMines     = 0;     // Number of mines in the game
	var difficulty   = 0;     // Difficulty level. 0 = Beginner, 1 = Interm., 2 = Expert, 3 = Custom
	var boardWidth   = 0;     // Number of tiles across the board
	var boardHeight  = 0;     // Number of tiles down the board
	var tiles        = null;  // Array of game tiles ([row][column])
	var tilesLeft    = 0;     // Number of uncovered tiles left, excluding mines
	var tileActive   = false; // Whether the mouse button was pressed down on a tile
	var groupActive  = false; // Whether the middle button was pressed down on a tile
	var allowMarks   = true;  // Whether ? tiles are allowed
	var allowSound   = false; // Whether sound plays on certain events
	var allowColor   = true;  // Whether to display a color gameboard
	var customSet    = false; // Whether the board has custom dimensions set up
	var customWidth  = 9;     // Width of board on custom level
	var customHeight = 9;     // Height of board on custom level
	var customMines  = 10;    // Number of mines on board on custom level
	var firstGame    = true;  // Whether this is the first game (used for initialization)
	var middleActive = false; // True when the middle mouse button is being held down (used for timer stop)
	var cheatActive  = false; // Whether the cheat pixel is turned on
	var cheatStep    = 0;     // The current step of the cheat activation process
	var touchTimer   = null;  // Long-press timer for touch devices
	var inputMode = "reveal";
	var embedded = new URLSearchParams(location.search).has("embedded");
	var displayScale = 1;
	var hostViewport = null;
	var layoutPending = false;
	var roundId = null;
	var startedAt = null;
	var touchState   = null;  // State of an in-progress touch (row/col/fired/xy)

	/**
	 * Tile object definition
	 *
	 * @return {undefined}
	 */
	function Tile()
	{
		this.number = 0;
		this.isMine = false;
		this.flagged = false;
		this.marked = false;
		this.triggered = false;
		this.exploded = false;
	}

	/*****************************************************
	 * Event Bindings
	 *****************************************************/

	// When the page has loaded, initialize the game
	$(function ()
	{
		// Handle global mouseup
		$("body").on("mouseup", function ()
		{
			// Set smiley back to :)
			$(".smiley-icon").removeClass("active");

			// Reset mousedown triggers
			tileActive = false;
			groupActive = false;

			// If middle mouse is down, raise all down tiles
			$(".ms-panel.down").removeClass("down");
		});

		// Bind keys
		$("body").on("keydown", function (e)
		{
			// Bind keys to Minesweeper window
			if ($(".window#ms-main").hasClass("focused"))
			{
				// F2 - new game
				if (e.which == 113)
				{
					e.preventDefault();
					initGame(difficulty);
				}
				// F1 - Help
				else if (e.which == 112)
				{
					e.preventDefault();
					openHelp();
				}
				// ESC - Timer stop feature
				else if (e.which == 27)
				{
					if (middleActive)
					{
						timerEnabled = false;
					}
				}

				// If the XYZZY cheat code is not active, handle the activation sequence (XYZZY + shift)
				if (!cheatActive)
				{
					// XYZ
					if (
						(e.which == 88 && cheatStep == 0) ||
						(e.which == 89 && (cheatStep == 1 || cheatStep == 4)) ||
						(e.which == 90 && (cheatStep == 2 || cheatStep == 3))
					)
					{
						cheatStep++;
					}
					// Shift
					else if (e.which == 16 && cheatStep == 5)
					{
						$("#cheatpx").css("display", "block");
						cheatActive = true;
					}
					// Any out of sequence key resets the cheat state
					else
					{
						cheatStep = 0;
					}
				}

				return;
			}

			// Bind keys to custom board dialog
			if ($(".window#ms-custom-board").hasClass("focused"))
			{
				// ESC - cancel
				if (e.which == 27)
				{
					customBoardCancel();
				}
				// Enter - whichever button is active, or confirm if text box is active
				else if (e.which == 13)
				{
					if ($(".cst-form input").is(":focus"))
					{
						customBoardConfirm();
					}
					else
					{
						$("#ms-custom-board .btns .btn-container.active").click();
					}
				}
				return;
			}

			// Bind keys to about dialog
			if ($(".window#ms-about").hasClass("focused"))
			{
				// ESC / Enter - OK
				if (e.which == 27 || e.which == 13)
				{
					aboutConfirm();
				}
				return;
			}

			// Bind keys to help dialog
			if ($(".window#ms-help").hasClass("focused"))
			{
				// ESC / Enter - OK
				if (e.which == 27 || e.which == 13)
				{
					helpConfirm();
				}
				return;
			}
		});

		// Any click in the minesweeper space will trigger the active face
		$(".minesweeper").off("mousedown").on("mousedown", function (e)
		{
			// If the window is frozen, do not perform the action
			if ($(this).closest(".window").hasClass("modal-frozen"))
			{
				return;
			}

			if (!gameOver && (e.which == 1 || e.which == 2))
			{
				// Set smiley icon to 8O face
				$(".smiley-icon").addClass("active");
			}

			if (e.which == 2)
			{
				// Set middle click held for timer stop feature
				middleActive = true;
			}
		});

		// Handle middle mouseup on the whole game board, for timer stop feature
		$(".minesweeper").off("mouseup").on("mouseup", function ()
		{
			middleActive = false;
		});


		// Smiley button click
		$(".smiley-btn").off("click").on("click", function ()
		{
			// Reset the game at the current difficulty
			initGame(difficulty);
		});

		// New game menu option
		$("#game_new").on("click", function ()
		{
			initGame(difficulty);
		});

		// Beginner menu option
		$("#game_beg:not(.disabled)").on("click", function ()
		{
			setDifficulty(0);
		});

		// Intermediate menu option
		$("#game_int:not(.disabled)").on("click", function ()
		{
			setDifficulty(1);
		});

		// Expert menu option
		$("#game_exp:not(.disabled)").on("click", function ()
		{
			setDifficulty(2);
		});

		// Custom menu option
		$("#game_cst:not(.disabled)").on("click", function ()
		{
			// Open the customization dialog and position it at the top left of the game board
			// Also, preload it with the current values of the custom board
			var containerOffset = $(".minesweeper").offset();
			$("#ms-custom-board #cst-height").val(customHeight);
			$("#ms-custom-board #cst-width").val(customWidth);
			$("#ms-custom-board #cst-mines").val(customMines);
			env.showWindow($("#ms-custom-board"), containerOffset.left, containerOffset.top, $("#ms-main"));
		});

		// Fullscreen (fit-to-screen) menu option
		$("#game_scr:not(.disabled)").on("click", function ()
		{
			setDifficulty(4);
		});

		// Enable/disabled mark tile menu option
		$("#game_mrk:not(.disabled)").on("click", function ()
		{
			setMarks(!allowMarks);
		});

		// Enable/disable sound
		$("#game_snd:not(.disabled)").on("click", function ()
		{
			setSound(!allowSound);
		});

		// Enable/disable color
		$("#game_clr:not(.disabled)").on("click", function ()
		{
			setColor(!allowColor);
		});

		// Open the current user's personal records
		$("#game_records:not(.disabled)").on("click", function ()
		{
			notifyPlatform("records", {});
		});

		// Open the about dialog
		$("#help_abt:not(.disabled)").on("click", function ()
		{
			openAbout();
		});

		// Open the help dialog
		$("#help_play:not(.disabled)").on("click", function ()
		{
			openHelp();
		});

		// Commit the changes in the custom field dialog
		$("#cst_ok").on("click", customBoardConfirm);

		// Cancel the changes in the custom field dialog
		$("#cst_cancel").on("click", customBoardCancel);

		// Close the about dialog
		$("#about_ok").on("click", aboutConfirm);

		// Close the help dialog
		$("#help_ok").on("click", helpConfirm);

		// Initialize the game
		preload();
	});

	/**
	 * Binds events to elements which might be regenerated
	 * This must happen every time the game is initialized to ensure bindings don't get lost
	 *
	 * @return {undefined}
	 */
	function rebindEvents()
	{
		// Block context menu on windows
		$(".window *").off("contextmenu").on("contextmenu", function (e)
		{
			e.preventDefault();
		});

		// Handle mousedown on a mine panel
		$(".minesweeper .ms-panel").off("mousedown").on("mousedown", function (e)
		{
			// If the window is frozen, do not perform the action
			if ($(this).closest(".window").hasClass("modal-frozen"))
			{
				return;
			}

			// Left mouse button when game has not ended and panel is not triggered
			if (!gameOver)
			{
				switch (e.which)
				{
					case 1:
						// Left mouse press
						tileActive = true;
						$(this).trigger("mouseenter");
						break;
					case 2:
						// Middle mouse press
						groupActive = true;
						$(this).trigger("mouseenter");
						break;
					case 3:
						// Right mouse press - forward the event to the click handler
						var target = $(this);
						handlePanelClick(target, e);
						break;
					default:
						break;
				}
			}
		});

		// Handle mouseenter on a mine panel (if the mouse button was clicked)
		// Also handle the cheat pixel color here, if the cheat is turned on
		$(".minesweeper .ms-panel").off("mouseenter").on("mouseenter", function ()
		{
			var coords = getCoords($(this));

			if (tileActive && !$(this).hasClass("flagged"))
			{
				// Apply the down action
				$(this).addClass("down");
			}
			else if (groupActive)
			{
				// Apply the down action on element and all surrounding it
				var tileRange = getTileRange(coords[0], coords[1]);

				for (var currentRow = tileRange[0][0]; currentRow <= tileRange[0][1]; currentRow++)
				{
					for (var currentCol = tileRange[1][0]; currentCol <= tileRange[1][1]; currentCol++)
					{
						if (!isFlagged(currentRow, currentCol))
						{
							$(".ms-panel[data-coord=\"" + currentRow + "," + currentCol + "\"]").addClass("down");
						}
					}
				}
			}

			if (cheatActive)
			{
				if (isMine(coords[0], coords[1]))
				{
					$("#cheatpx").css("background-color", "#000");
				}
				else
				{
					$("#cheatpx").css("background-color", "#FFF");
				}
			}
		});

		// Handle mouseleave on a mine panel
		$(".minesweeper .ms-panel").off("mouseleave").on("mouseleave", function (e)
		{
			// Left or middle mouse button will cause all downed tiles to reset
			if ((tileActive || groupActive) && (e.which == 1 || e.which == 2))
			{
				// Remove the down class
				$(".ms-panel.down").removeClass("down");
			}
		});

		// Handle mouseup on mine panel
		$(".minesweeper .ms-panel").off("mouseup").on("mouseup", function (e)
		{
			if ((tileActive || groupActive) && !gameOver)
			{
				var target = $(this);
				handlePanelClick(target, e);
			}
		});

		$(".minesweeper .ms-panel").off("touchstart touchmove touchend touchcancel")
			.on("touchstart", function(e) {
				if (gameOver || $(this).closest(".window").hasClass("modal-frozen") || e.originalEvent.touches.length !== 1) { touchState=null; return; }
				var point=e.originalEvent.touches[0], coord=getCoords($(this));
				touchState={row:coord[0],col:coord[1],x:point.clientX,y:point.clientY,id:point.identifier,mode:inputMode};
			})
			.on("touchmove", function(e) {
				var point=e.originalEvent.touches[0];
				if (touchState && (!point || e.originalEvent.touches.length!==1 || Math.abs(point.clientX-touchState.x)>8 || Math.abs(point.clientY-touchState.y)>8)) touchState=null;
			})
			.on("touchend", function(e) {
				var state=touchState; touchState=null;
				if (!state) return;
				e.preventDefault();
				var ended=Array.from(e.originalEvent.changedTouches).some(function(p){return p.identifier===state.id;});
				if (ended && e.originalEvent.touches.length===0 && !$(this).closest(".window").hasClass("modal-frozen")) applyModeAt(state.row,state.col,state.mode);
			})
			.on("touchcancel",function(){touchState=null;});

	}

	/*****************************************************
	 * UI Interaction Functions
	 *****************************************************/

	/**
	 * Preloads necessary assets before starting the game
	 *
	 * @return {undefined}
	 */
	function preload()
	{
		$("body").addClass("loading");

		var preloadImages = ["about_header.gif", "sprite.gif", "spritebw.gif", "bw_bg.gif", "cursor_default.gif", "cursor_pointer.gif"];
		var promises = [];

		var loadAsset = function (url, promise)
		{
			var asset = new Image();
			var timeout = setTimeout(function () { promise.resolve(); }, 5000);
			asset.onload = asset.onerror = function () { clearTimeout(timeout); promise.resolve(); };

			asset.src = url;
		};

		// Preload images
		for (var img = 0; img < preloadImages.length; img++)
		{
			promises[img] = $.Deferred();
			loadAsset("img/" + preloadImages[img], promises[img]);
		}

		// Launch the game when we're ready
		$.when.apply($, promises).done(function ()
		{
			$("body").removeClass("loading");
			initGame(0);
		});
	}

	/**
	 * Event handler for custom board dialog OK
	 *
	 * @return {undefined}
	 */
	function customBoardConfirm()
	{
		// Set up a new game board with the custom parameters
		var cstWidth = $("#cst-width").val();
		var cstHeight = $("#cst-height").val();
		var cstMines = $("#cst-mines").val();

		setCustomBoard(cstWidth, cstHeight, cstMines);
		setDifficulty(3);
		env.closeWindow($("#ms-custom-board"));
	}

	/**
	 * Event handler for custom board dialog cancel
	 *
	 *
	 * @return {undefined}
	 */
	function customBoardCancel()
	{
		// Canceling the custom dialog results in resetting the current game board
		initGame(difficulty);
		env.closeWindow($("#ms-custom-board"));
	}

	/**
	 * Event handler for high score dialog OK
	 *
	 * @return {undefined}
	 */
	function openAbout()
	{
		var containerOffset = $(".minesweeper").offset();
		env.showWindow($("#ms-about"), containerOffset.left + 30, containerOffset.top + 33, $("#ms-main"));
	}

	/**
		* Event handler for about dialog OK
		*
		* @return {undefined}
		*/
	function aboutConfirm()
	{
		env.closeWindow($("#ms-about"));
	}

	/**
		* Opens the help window
		*
		* @return {undefined}
		*/
	function openHelp()
	{
		var containerOffset = $(".minesweeper").offset();
		env.showWindow($("#ms-help"), containerOffset.left + 30, containerOffset.top + 33, $("#ms-main"));
	}

	/**
		* Event handler for help dialog OK
		*
		* @return {undefined}
		*/
	function helpConfirm()
	{
		$("#ms-help .help-content-inner").scrollTop(0);
		env.closeWindow($("#ms-help"));
	}

	/**
	 * Enables or disables sound
	 *
	 * @param {boolean} enabled True to enable, false to disable
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setSound(enabled, skipSave)
	{
		// Apply the setting
		if (enabled == true)
		{
			allowSound = true;
			$("#game_snd").addClass("checked");
		}
		else
		{
			allowSound = false;
			$("#game_snd").removeClass("checked");
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("snd", allowSound);
		}
	}

	/**
	 * Enables or disables marks (?)
	 *
	 * @param {boolean} enabled True to enable, false to disable
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setMarks(enabled, skipSave)
	{
		// Apply the setting
		if (enabled == true)
		{
			allowMarks = true;
			$("#game_mrk").addClass("checked");
		}
		else
		{
			allowMarks = false;
			$("#game_mrk").removeClass("checked");
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("mrk", allowMarks);
		}
	}

	/**
	 * Enables or disables color display
	 *
	 * @param {boolean} enabled True to enable, false to disable
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setColor(enabled, skipSave)
	{
		// Apply the setting
		if (enabled == true)
		{
			allowColor = true;
			$("#game_clr").addClass("checked");
			$(".minesweeper").removeClass("no-color");
		}
		else
		{
			allowColor = false;
			$("#game_clr").removeClass("checked");
			$(".minesweeper").addClass("no-color");
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("clr", allowColor);
		}
	}

	/**
	 * Sets the difficulty level
	 *
	 * @param {int} diff level
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setDifficulty(diff, skipSave)
	{
		// Only accept valid levels
		if (!Number.isInteger(Number(diff)) || Number(diff) < 0 || Number(diff) > 4)
		{
			return;
		}

		// Reset custom board if switching away from it
		if (diff != 3)
		{
			customWidth = 9;
			customHeight = 9;
			customMines = 10;
			customSet = false;
		}

		// Adjust the context menu entries
		var lvl = ["beg", "int", "exp", "cst", "scr"];
		for (var currentLvl = 0; currentLvl < lvl.length; currentLvl++)
		{
			var element = $("#game_" + lvl[currentLvl]);
			if (currentLvl == diff)
			{
				element.addClass("checked");
			}
			else
			{
				element.removeClass("checked");
			}
		}

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("lvl", diff);
		}

		// Apply the setting
		initGame(diff);
	}

	/**
	 * Sets up custom board dimensions
	 *
	 * @param {int} width  Width of board
	 * @param {int} height Height of board
	 * @param {int} mines  Number of mines to place
	 * @param {boolean} skipSave If true, do not save preference
	 * @return {undefined}
	 */
	function setCustomBoard(width, height, mines, skipSave)
	{
		// Override invalid board preferences
		// Width must be a decimal integer
		if (!/^\d*$/.test(width))
		{
			width = 9;
		}

		// Width must be between 9 and 30, inclusive
		width = (width > 30 ? 30 : width);
		width = (width < 9 ? 9 : width);

		// Height must be a decimal integer
		if (!/^\d*$/.test(height))
		{
			height = 9;
		}

		// Height must be between 9 and 24, inclusive
		height = (height > 24 ? 24 : height);
		height = (height < 9 ? 9 : height);

		// Number of mines must be a decimal integer
		if (!/^\d*$/.test(mines))
		{
			mines = 10;
		}

		// Mines must be between 10 and (x-1)(y-1), inclusive
		mines = (mines < 10 ? 10 : mines);
		var minesAllowed = (height - 1) * (width - 1);
		mines = (mines > minesAllowed ? minesAllowed : mines);

		// Update the game state
		customSet = true;
		customWidth = width;
		customHeight = height;
		customMines = mines;

		// Write preference to local storage if enabled
		if (!skipSave)
		{
			setLocalStorageValue("board_width", width);
			setLocalStorageValue("board_height", height);
			setLocalStorageValue("board_mines", mines);
		}
	}

	/**
	 * Chord: open all unflagged neighbors of an open number tile when the
	 * surrounding flag count matches the tile number (used by middle-click
	 * and by the touch gesture layer).
	 *
	 * @param {int} row Row of the tile
	 * @param {int} col Column of the tile
	 * @return {undefined}
	 */
	function chordAt(row, col)
	{
		if (gameOver || !isNumber(row, col) || !isTriggered(row, col))
		{
			return;
		}

		var tileRange = getTileRange(row, col);
		var triggerQueue = [];

		// Number of flags left to find in range
		var flagsLeft = getNumber(row, col);

		// Go through each tile around the one clicked
		for (var currentRow = tileRange[0][0]; currentRow <= tileRange[0][1]; currentRow++)
		{
			for (var currentCol = tileRange[1][0]; currentCol <= tileRange[1][1]; currentCol++)
			{
				// Skip the clicked tile
				if (currentRow == row && currentCol == col)
				{
					continue;
				}

				// If tile is flagged, subtract from number of flags left
				if (isFlagged(currentRow, currentCol))
				{
					flagsLeft--;
				}
				// Otherwise, add to the trigger queue
				else
				{
					triggerQueue.push([currentRow, currentCol]);
				}
			}
		}

		// If there are the wrong number of flags, abort!
		if (flagsLeft != 0)
		{
			return;
		}

		// Reorder the trigger queue to put mines last
		// This guarantees that non-mine tiles will trigger before
		// a game-ending explosion.
		var tilesInQueue = triggerQueue.length;
		for (var currentTile = 0; currentTile < tilesInQueue; currentTile++)
		{
			var tRow = triggerQueue[currentTile][0];
			var tCol = triggerQueue[currentTile][1];

			if (isMine(tRow, tCol))
			{
				triggerQueue.splice(currentTile, 1);
				triggerQueue.push([tRow, tCol]);

				// Shorten the array and rewind
				tilesInQueue--;
				currentTile--;
			}
		}

		// Trigger the mines--err.. tiles. >:)
		for (var currentMine = 0; currentMine < triggerQueue.length; currentMine++)
		{
			var mRow = triggerQueue[currentMine][0];
			var mCol = triggerQueue[currentMine][1];
			trigger(mRow, mCol);
		}
	}

	/**
	 * Cycles the mark state of an untriggered tile: flag -> question -> clear
	 * (the right-click behavior, also used by the touch gesture layer).
	 *
	 * @param {int} row Row of the tile
	 * @param {int} col Column of the tile
	 * @return {undefined}
	 */
	function toggleMarkAt(row, col)
	{
		// Handle flagging and marking tiles
		if (!gameOver && !isTriggered(row, col))
		{
			// If tile is "fresh", add a flag
			if (!isFlagged(row, col) && !isMarked(row, col))
			{
				flag(row, col);
				subMine();

			}
			// If tile is flagged and it is allowed, mark the tile
			else if (allowMarks && isFlagged(row, col))
			{
				// Mark the tile and restore a mine to the counter
				mark(row, col);
				addMine();
			}
			// Tile must be marked, so clear it
			else
			{
				// If marks aren't allowed, add back the mine value here instead
				if (!allowMarks)
				{
					addMine();
				}

				clear(row, col);
			}
		}
	}

	/**
	 * Handles clicks for ms-panel elements
	 *
	 * @param {jquery} target The element attached to the event
	 * @param {event} ev Event properties
	 * @return {undefined}
	 */
	function applyModeAt(row,col,mode) {
		if (gameOver) return;
		var tile=tiles[row][col];
		if (tile.triggered) { chordAt(row,col); return; }
		if (mode === "reveal") {
			if (tile.flagged) return;
			if (tile.triggered) { chordAt(row,col); return; }
			if (gameWaiting) startGame();
			trigger(row,col); return;
		}
		if (tile.triggered) return;
		var wasFlagged=tile.flagged;
		if (mode === "flag") { tile.flagged=!tile.flagged; tile.marked=false; }
		else if (mode === "question") { tile.marked=!tile.marked; tile.flagged=false; }
		else return;
		minesLeft+=Number(wasFlagged)-Number(tile.flagged);
		digitRender("mines",minesLeft); rerender(row,col);

	}

	function handlePanelClick(target, ev)
	{
		// A target of type ms-panel must be provided
		if (!target.length || !target.hasClass("ms-panel"))
		{
			return;
		}

		// Load the coordinates of the target element
		var coord = getCoords(target);
		var row = coord[0];
		var col = coord[1];

		// Left click
		if (ev.which == 1)
		{
			// Set smiley back to :)
			$(".smiley-icon").removeClass("active");
			tileActive = false;

			applyModeAt(row,col,"reveal");
		}
		// Middle click (only on numbered tiles)
		if (ev.which == 2)
		{
			chordAt(row, col);
		}
		// Right click
		else if (ev.which == 3)
		{
			toggleMarkAt(row, col);
		}
	}

	/*****************************************************
	 * Tile Control and Metadata Functions
	 *****************************************************/

	/**
	 * Gets coordinates of a mine panel
	 *
	 * @param {jquery} target Element from which to get coordinates
	 * @return {array} Coordinates of tile [y,x]
	 */
	function getCoords(target)
	{
		var coords = target.data("coord").split(",");
		return [parseInt(coords[0], 10), parseInt(coords[1], 10)];
	}

	/**
	 * Flags a tile
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function flag(row, col)
	{
		var tile = tiles[row][col];

		// Tile may only be flagged if it is fresh
		if (!gameOver && !tile.triggered && !tile.marked)
		{
			tiles[row][col].flagged = true;
		}

		// Rerender the tile in its new state
		rerender(row, col);
	}

	/**
	 * Marks a tile ("?")
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function mark(row, col)
	{
		var tile = tiles[row][col];

		// Tile may only be marked if it is untriggered and flagged
		if (!gameOver && !tile.triggered && tile.flagged)
		{
			tile.flagged = false;
			tile.marked = true;
		}

		// Save the tile and rerender it
		tiles[row][col] = tile;
		rerender(row, col);
	}

	/**
	 * Clears marked and flagged statuses on a tile
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function clear(row, col)
	{
		var tile = tiles[row][col];

		// Tile may only be cleared if not triggered
		if (!gameOver && !tile.triggered)
		{
			tile.marked = false;
			tile.flagged = false;
		}

		// Save the tile and rerender it
		tiles[row][col] = tile;
		rerender(row, col);
	}

	/**
	 * Sets a tile as a mine
	 *
	 * @param {int} row Row to set
	 * @param {int} col Column to set
	 * @return {undefined}
	 */
	function mine(row, col)
	{
		tiles[row][col].isMine = true;
	}

	/**
	 * Checks whether a tile is triggered
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is triggered, false otherwise
	 */
	function isTriggered(row, col)
	{
		return tiles[row][col].triggered;
	}

	/**
	 * Checks whether a tile is a number
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is a number, false otherwise
	 */
	function isNumber(row, col)
	{
		return tiles[row][col].number != 0;
	}

	/**
	 * Checks whether a tile is marked
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is marked, false otherwise
	 */
	function isMarked(row, col)
	{
		return tiles[row][col].marked;
	}

	/**
	 * Checks whether a tile is flagged
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is flagged, false otherwise
	 */
	function isFlagged(row, col)
	{
		return tiles[row][col].flagged;
	}

	/**
	 * Checks whether a tile is a mine
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {boolean} True if tile is a mine, false otherwise
	 */
	function isMine(row, col)
	{
		return tiles[row][col].isMine;
	}

	/**
	 * Returns the number of a tile
	 *
	 * @param {int} row Row to check
	 * @param {int} col Column to check
	 * @return {int} Number of tile
	 */
	function getNumber(row, col)
	{
		return tiles[row][col].number;
	}

	/*****************************************************
	 * Tile Actions
	 *****************************************************/

	/**
	 * Adds a mine to the mine counter
	 *
	 * @return {undefined}
	 */
	function addMine()
	{
		if (minesLeft < maxMines)
		{
			minesLeft++;
			digitRender("mines", minesLeft);
		}
	}

	/**
	 * Removes a mine from the mine counter
	 *
	 * @return {undefined}
	 */
	function subMine()
	{
		minesLeft--;
		digitRender("mines", minesLeft);
	}

	/**
	 * Triggers a tile
	 *
	 * @param {int} row Row to trigger
	 * @param {int} col Column to trigger
	 * @return {undefined}
	 */
	function trigger(row, col)
	{
		var pending = [[row, col]];
		while (pending.length && !gameOver) {
			var next = pending.pop(); row = next[0]; col = next[1];
			var tile = tiles[row][col];
			if (tile.triggered || tile.flagged) continue;
			if (noMoves && tile.isMine) { tile.isMine = false; setNumbers(row,col,true); placeMine(row,col); }
			noMoves = false; tile.triggered = true; tile.marked = false;
			if (tile.isMine) { explode(row,col); return; }
			rerender(row,col);
			if (--tilesLeft === 0) { winGame(); return; }
			if (tile.number === 0) {
				var range = getTileRange(row,col);
				for (var r=range[0][0];r<=range[0][1];r++) for (var c=range[1][0];c<=range[1][1];c++) {
					if (!tiles[r][c].triggered && !tiles[r][c].flagged && !tiles[r][c].isMine) pending.push([r,c]);
				}
			}
		}
	}

	/**
	 * Detonates a mine (boom)
	 *
	 * @param {int} row Row to explode
	 * @param {int} col Column on which to make blam
	 * @return {undefined}
	 */
	function explode(row, col)
	{
		var tile = tiles[row][col];

		// Sanity check - only mines explode!
		if (!tile.isMine)
		{
			return;
		}

		// Mark tile as exploded
		tile.exploded = true;
		tiles[row][col] = tile;

		// Play explosion sound, if enabled
		if (allowSound)
		{
			playSound("snd_explode");
		}

		// End the game!
		endGame();

		// Reveal mine tiles and incorrect flags, and leave good flags alone
		for (var currentRow = 0; currentRow < boardHeight; currentRow++)
		{
			for (var currentCol = 0; currentCol < boardWidth; currentCol++)
			{
				var tileToTrigger = tiles[currentRow][currentCol];
				var mustRender = false;

				// If this is an unflagged mine, rerender it
				if (!tileToTrigger.flagged && tileToTrigger.isMine)
				{
					mustRender = true;
				}
				// If bogus flag, remove number and rerender it
				else if (!tileToTrigger.isMine && tileToTrigger.flagged)
				{
					mustRender = true;
					tileToTrigger.number = 0;
				}

				// Trigger the tile, save it, and rerender it
				if (mustRender)
				{
					tileToTrigger.triggered = true;
					tiles[currentRow][currentCol] = tileToTrigger;
					rerender(currentRow, currentCol);
				}
			}
		}

		// Murder the smiley :(
		$(".smiley-icon").addClass("dead");
	}

	/*****************************************************
	 * UI Rendering
	 *****************************************************/

	/**
	 * Renders a tile in its current internal state
	 *
	 * @param {int} row Row to render
	 * @param {int} col Column to render
	 * @return {undefined}
	 */
	function rerender(row, col)
	{
		// Locate the target in the DOM and load its metadata
		var target = $(".ms-panel[data-coord=\"" + row + "," + col + "\"]");
		var tile = tiles[row][col];

		// Reset the state of the panel
		target.removeClass("triggered mine exploded m1 m2 m3 m4 m5 m6 m7 m8 flagged marked");

		// Some states are only available if the tile is triggered
		if (tile.triggered)
		{
			target.addClass("triggered");

			// If the tile has a number, show it
			if (tile.number > 0)
			{
				target.addClass("m" + tile.number);
			}

			// If the tile is a mine, show it
			if (tile.isMine)
			{
				target.addClass("mine");
			}

			// If the tile is a mine, show it
			if (tile.exploded)
			{
				target.addClass("exploded");
			}

			// If a triggered tile is flagged and is not a mine, show bogus marker
			if (!tile.isMine && tile.flagged)
			{
				target.addClass("bogus");
			}
		}
		else
		{
			// Show flag if tile is flagged
			if (tile.flagged)
			{
				target.addClass("flagged");
			}

			if (tile.marked)
			{
				target.addClass("marked");
			}
		}
	}

	/**
	 * Renders digits on the digital number boxes
	 *
	 * @param {string} target ID of the element to render (must be num-box class)
	 * @param {int} number Number to render on the display
	 * @return {undefined}
	 */
	function digitRender(target, number)
	{
		// If the number is out of displayable bounds, display the bound
		if (number < -99)
		{
			number = -99;
		}
		else if (number > 999)
		{
			number = 999;
		}

		target = ".num-box#" + target;

		// Determine each digit of the display
		var num = Math.abs(number);
		var hundreds = Math.floor(num / 100);
		num -= hundreds * 100;
		var tens = Math.floor(num / 10);
		num -= tens * 10;

		// Make hundreds place a hyphen if negative
		if (number < 0)
		{
			hundreds = "n";
		}

		// Set the display
		$(target + " .digit").removeClass("d0 d1 d2 d3 d4 d5 d6 d7 d8 d9 dn");
		$(target + " .digit.iii").addClass("d" + hundreds);
		$(target + " .digit.ii").addClass("d" + tens);
		$(target + " .digit.i").addClass("d" + num);
	}

	/*****************************************************
	 * Game Generation
	 *****************************************************/

	/**
	 * Initializes the game
	 *
	 * @param {int} diff Difficulty of the game - see def at top of file for details
	 * @param {int} width Optional board width specification (diff = 3)
	 * @param {int} height Optional board height specification (diff = 3)
	 * @param {int} mines Optional number of mines specification (diff = 3)
	 * @return {undefined}
	 */
	function initGame(diff)
	{
		clearTimeout(touchTimer); touchState = null; roundId = makeRoundId(); startedAt = null;
		// Reset the game state
		endGame();
		gameWaiting = true;
		gameOver = false;
		noMoves = true;
		timerEnabled = true;

		// If custom settings are not set, override custom difficulty
		// Also do this if the difficulty setting is invalid
		if (!Number.isInteger(Number(diff)) || Number(diff) < 0 || Number(diff) > 4 || (diff == 3 && !customSet))
		{
			diff = 0;
		}

		// Set up defaults based on difficulty level, unless using a custom setting
		var defaults = {
			"width": [9, 16, 30],
			"height": [9, 16, 16],
			"mines": [10, 40, 99]
		};

		// Set defaults if using a non-custom difficulty
		var width, height, mines;
		if (diff == 3)
		{
			width = customWidth;
			height = customHeight;
			mines = customMines;
		}
		else if (diff == 4)
		{
			// 满屏：按视口自适应生成棋盘，雷密度与专家级一致（99/480），小于专家级则相应调低
			var vw = hostViewport ? hostViewport.width/displayScale-32 : $(window).width()-80;
			var vh = hostViewport ? hostViewport.height/displayScale-105 : $(window).height()-200;
			width = Math.max(9, Math.min(60, Math.floor(vw / 16)));
			height = Math.max(9, Math.min(40, Math.floor(vh / 16)));
			var tileTotal = width * height;
			var density = (tileTotal >= 480) ? 99 / 480 : 0.123 + (0.20625 - 0.123) * (tileTotal - 81) / (480 - 81);
			mines = Math.max(10, Math.min(tileTotal - 10, Math.round(tileTotal * density)));
		}
		else
		{
			width = defaults.width[diff];
			height = defaults.height[diff];
			mines = defaults.mines[diff];
		}

		// Set up initial game data
		maxMines = mines;
		minesLeft = mines;
		boardWidth = width;
		boardHeight = height;
		difficulty = diff;
		time = 0;
		tiles = [];
		tilesLeft = (width * height) - mines;

		// On first game, initialize some preferences
		if (firstGame)
		{
			firstGame = false;
			// Restore sound preference
			var sndPref = getLocalStorageValue("snd");
			sndPref = (sndPref == "true") ? true : false;
			setSound(sndPref, true);

			// Restore marks preference
			var mrkPref = getLocalStorageValue("mrk");
			mrkPref = (mrkPref == "true" || mrkPref == null) ? true : false;
			setMarks(mrkPref, true);

			// Restore color preference
			var clrPref = getLocalStorageValue("clr");
			clrPref = (clrPref == "true" || clrPref == null) ? true : false;
			setColor(clrPref, true);

			// Restore level preference
			// This must be last because it may reinitialize the game board
			var lvlPref = getLocalStorageValue("lvl");
			var bwPref = getLocalStorageValue("board_width");
			var bhPref = getLocalStorageValue("board_height");
			var bmPref = getLocalStorageValue("board_mines");
			if (lvlPref != null)
			{
				// Don't restore the preference if custom has invalid bounds
				if (lvlPref != 3 || (bwPref != null && bhPref != null && bmPref != null))
				{
					if (lvlPref == 3)
					{
						setCustomBoard(bwPref, bhPref, bmPref, true);
					}

					setDifficulty(lvlPref, true);

					// Break out so that the board does not initialize multiple times
					return;
				}
			}
		}

		// Create the grid
		generateGrid();

		// Render the numeric displays with initial values
		digitRender("time", time);
		digitRender("mines", minesLeft);

		// Reset the smiley icon :)
		$(".smiley-icon").removeClass("active cool dead");

		// Bind event handlers
		rebindEvents();

		// Display the window if it was hidden
		env.showWindow($("#ms-main"), 40, 40);
		reportLayout();
	}

	/**
	 * Generates game grid in memory and then renders the displayed grid
	 *
	 * @return {undefined}
	 */
	function generateGrid()
	{
		var grid = "";
		// Cycle through rows (ms-row)
		for (var row = 0; row < boardHeight; row++)
		{
			// Create array for each row
			tiles.push([]);
			grid += "<div class='ms-row'>";

			// Cycle through each tile in the row
			for (var col = 0; col < boardWidth; col++)
			{
				// Add the default object to the game array
				tiles[row].push(new Tile());
				grid += "<div class='ms-panel' data-coord='" + row + "," + col + "'></div>";
			}

			grid += "</div>";
		}

		// Place the appropriate number of mines
		var mineNum = maxMines;
		while (mineNum--)
		{
			placeMine();
		}

		// Render the grid
		$(".ms-grid").html(grid);
	}

	/**
	 * Places a mine in a random location on the grid
	 *
	 * @param {int} exclRow Optional row to exclude from mine
	 * @param {int} exclCol Optional column to exclude from mine
	 * @return {undefined}
	 */
	function placeMine(exclRow, exclCol)
	{
		// Disable exclusion check if coordinate not provided
		var excl = typeof exclRow != "undefined";

		// Default values
		var row = -1;
		var col = -1;
		var tile = null;

		// Generate a new coordinate until a non-triggered, non-mine, unexcluded tile is found
		do
		{
			row = getRandomNumber(0, boardHeight - 1);
			col = getRandomNumber(0, boardWidth - 1);
			tile = tiles[row][col];
		}
		while (tile.isMine || (excl && row == exclRow && col == exclCol));

		// Make the tile a mine
		tiles[row][col].number = 0;
		mine(row, col);

		// Surround tile with numbers
		setNumbers(row, col);
	}

	/**
	 * Increases numbers surrounding a tile
	 *
	 * @param {int} row Row subcoord for center tile
	 * @param {int} col Column subcoord for center tile
	 * @param {boolean} recalc Optional - forces the number to be recalculated
	 * @return {undefined}
	 */
	function setNumbers(row, col, recalc)
	{
		// Loop through up to nine tiles
		var tileRange = getTileRange(row, col);
		var adjMines = 0;
		for (var currentRow = tileRange[0][0]; currentRow <= tileRange[0][1]; currentRow++)
		{
			for (var currentCol = tileRange[1][0]; currentCol <= tileRange[1][1]; currentCol++)
			{
				// If mine, add to the count of adjacent mines and then ignore the tile
				if (isMine(currentRow, currentCol))
				{
					adjMines++;
					continue;
				}

				// Ignore the central tile
				if ((row == currentRow && col == currentCol))
				{
					continue;
				}

				// Increase or decrease the number on the adjacent tile
				if (!recalc)
				{
					tiles[currentRow][currentCol].number++;
				}
				else
				{
					tiles[currentRow][currentCol].number--;
				}
			}
		}

		// If there is a mine within range, we need to add a number
		// where the mine was removed
		if (recalc)
		{
			tiles[row][col].number = adjMines;
		}
	}

	/**
	 * Generates a pseudo-random integer
	 *
	 * @param {int} min Minimum value (inclusive)
	 * @param {int} max Maximum value (inclusive)
	 * @return {int} Generated number
	 */
	function getRandomNumber(min, max)
	{
		return Math.floor(Math.random() * (max + 1 - min)) + min;
	}

	/**
	 * Provides range of tiles surrounding a specified tile
	 *
	 * @param {int} row Row of tile to use
	 * @param {int} col Column of file to use
	 * @return {array} List of surrounding tiles [[rowMin, rowMax], [colMin, colMax]]
	 */
	function getTileRange(row, col)
	{
		// Get surrounding tiles, within the board
		var rowMinBound = (row == 0) ? 0 : row - 1;
		var rowMaxBound = (row == boardHeight - 1) ? boardHeight - 1 : row + 1;
		var colMinBound = (col == 0) ? 0 : col - 1;
		var colMaxBound = (col == boardWidth - 1) ? boardWidth - 1 : col + 1;

		return [[rowMinBound, rowMaxBound], [colMinBound, colMaxBound]];
	}

	/*****************************************************
	 * Game Control
	 *****************************************************/

	/**
	 * Starts the game
	 *
	 * @return {undefined}
	 */
	function startGame()
	{
		if (gameWaiting)
		{
			gameWaiting = false;
			gameOver = false;
			startedAt = performance.now();
			notifyPlatform("started", {runId:roundId, difficulty:["beginner","intermediate","expert","custom","screen"][Number(difficulty)],width:Number(boardWidth),height:Number(boardHeight),mines:Number(maxMines)});
			timeStart();
		}
	}

	/**
	 * Ends the game
	 *
	 * @return {undefined}
	 */
	function endGame()
	{
		// If the game is active, stop the running timer
		gameOver = true;
		timeStop();
	}

	/**
	 * Ends the game with the user winning
	 *
	 * @return {undefined}
	 */
	function winGame()
	{
		if (gameOver) return;
		notifyPlatform("won", {runId:roundId,elapsedMs:Math.max(0,Math.floor(performance.now()-startedAt)),assisted:cheatActive || !timerEnabled});
		// Smiley is very happy B)
		$(".smiley-icon").addClass("cool");

		// Play win sound, if enabled
		if (allowSound)
		{
			playSound("snd_win");
		}

		// Game over!
		endGame();
	}

	/**
	 * Resets and starts the game time
	 *
	 * @return {undefined}
	 */
	function timeStart() {
		clearInterval(timer);
		timeTick();
		timer = setInterval(timeTick, 250);
	}

	/**
	 * Stops the game timer
	 *
	 * @return {undefined}
	 */
	function timeStop()
	{
		clearInterval(timer);
	}

	/**
	 * Increments the timer on tick
	 *
	 * @return {undefined}
	 */
	function timeTick() {
		if (!timerEnabled || startedAt === null) return;
		var elapsed = Math.min(999,Math.floor((performance.now()-startedAt)/1000));
		if (elapsed !== time) { time=elapsed; digitRender("time",time); if (allowSound) playSound("snd_tick"); }
	}

	/*****************************************************
	 * Local Storage Wrappers
	 *****************************************************/

	/**
	 * Retrieves data from local storage
	 *
	 * @param {string} key local storage key
	 * @return {object|null} The contents of local storage at the specified key, or null if there is no value for the key.
	 */
	function getLocalStorageValue(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
	function setLocalStorageValue(key,value) { try { window.localStorage.setItem(key,value); } catch (e) {} }
	function playSound(id) { try { var result=document.getElementById(id).play(); if (result && result.catch) result.catch(function() {}); } catch (e) {} }
	function makeRoundId() {
		var bytes=new Uint8Array(16); crypto.getRandomValues(bytes); bytes[6]=(bytes[6]&15)|64; bytes[8]=(bytes[8]&63)|128;
		var hex=Array.from(bytes,function(b){return b.toString(16).padStart(2,"0");}).join("");
		return hex.slice(0,8)+"-"+hex.slice(8,12)+"-"+hex.slice(12,16)+"-"+hex.slice(16,20)+"-"+hex.slice(20);
	}
	function reportLayout() {
		if (!embedded || layoutPending) return;
		layoutPending=true;
		requestAnimationFrame(function() {
			layoutPending=false;
			var main=document.getElementById("ms-main"); if(!main) return;
			var rect=main.getBoundingClientRect(), width=rect.width, height=rect.height;
			$("#ms-main .menu:visible").each(function(){var r=this.getBoundingClientRect();width=Math.max(width,r.right);height=Math.max(height,r.bottom);});
			$(".window.open:not(#ms-main)").each(function(){var box=this.getBoundingClientRect();width=Math.max(width,box.width+20);height=Math.max(height,box.height+20);});
			notifyPlatform("layout",{width:Math.ceil(width+2),height:Math.ceil(height+2),difficulty:Number(difficulty),mode:inputMode});
		});
	}
	if (embedded) {
		document.documentElement.classList.add("embedded");
		$(function(){
			new MutationObserver(reportLayout).observe(document.getElementById("desktop"),{subtree:true,attributes:true,childList:true});
			$(window).on("resize",reportLayout);
			$(document).on("touchstart",function(e){if(e.originalEvent.touches.length>1) touchState=null;});
		});
		window.addEventListener("message",function(event){
			if(event.source!==window.parent || event.origin!==location.origin || event.data?.channel!=="boardgame:minesweeper:control")return;
			var msg=event.data;
			if(msg.type==="mode" && ["reveal","flag","question"].indexOf(msg.value)!==-1){inputMode=msg.value;touchState=null;}
			if(msg.type==="profile" && msg.value==="desktop"){inputMode="reveal";touchState=null;}
			if(msg.type==="records-enabled" && typeof msg.value==="boolean") $("#game_records").toggle(msg.value);
			if(msg.type==="new")initGame(difficulty);
			if(msg.type==="difficulty" && Number.isInteger(msg.value) && msg.value>=0 && msg.value<=4) {
				if(msg.value===3) $("#game_cst").click(); else setDifficulty(msg.value);
			}
			if(msg.type==="viewport" && msg.value && Number.isFinite(msg.value.width) && Number.isFinite(msg.value.height)){
				hostViewport={width:Math.max(250,Math.min(2500,msg.value.width)),height:Math.max(300,Math.min(1600,msg.value.height))};
				displayScale=msg.value.scale===2 ? 2 : 1.5;document.documentElement.style.zoom=displayScale;document.documentElement.style.setProperty("--classic-scale",displayScale);document.documentElement.style.setProperty("--host-width",hostViewport.width+"px");
			}
			reportLayout();
		});
	}
	function notifyPlatform(type,data) {
		if (window.parent !== window && location.protocol !== "file:") window.parent.postMessage({channel:"boardgame:minesweeper",type:type,data:data},location.origin);
		else if (type === "won" || type === "records") $("#record-status").text(type === "won" ? "通关成功！独立打开不保存账号记录，请从平台进入。" : "账号通关记录请从平台扫雷页面进入。");
	}

})();



