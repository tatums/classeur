angular.module('classeur.core.explorerLayout', [])
	.directive('clFolderButton', function(clExplorerLayoutSvc, clPanel) {
		return {
			restrict: 'A',
			link: function(scope, element) {
				var elt = element[0];
				var parentElt = elt.parentNode;
				var buttonPanel = clPanel(element);
				var speed;
				var isOpen;

				function animate() {
					element.toggleClass('open', isOpen);
					var y = scope.$index * 109;
					var z = isOpen ? 10000 : (scope.folderDao ? scope.explorerLayoutSvc.folders.length - scope.$index : 9998);
					buttonPanel.css('z-index', z).$$elt.offsetWidth; // Force z-offset to refresh before the animation
					buttonPanel.move(speed).translate(isOpen ? 0 : -4, y).ease('out').then(function() {
						if (isOpen) {
							// Adjust scrolling position
							var minY = parentElt.scrollTop + 20;
							var maxY = parentElt.scrollTop + parentElt.clientHeight - 360;
							if (y > maxY) {
								parentElt.scrollTop += y - maxY;
							}
							if (y < minY) {
								parentElt.scrollTop += y - minY;
							}
						}
					}).end();
					speed = 'fast';
				}

				scope.$watch('$index', animate);
				scope.$watch('explorerLayoutSvc.currentFolderDao === folderDao || folderDao.isDraggingTarget', function(isEqual) {
					isOpen = isEqual;
					animate();
				});
			}
		};
	})
	.directive('clFileEntry', function(clExplorerLayoutSvc) {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/fileEntry.html',
			link: function(scope, element) {
				var nameInput = element[0].querySelector('input.name');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which === 27 || e.which === 13) {
						// Esc key
						nameInput.blur();
					}
				});
				scope.open = function() {
					!scope.isEditing && scope.setCurrentFile(scope.fileDao);
				};
				scope.setEditing = function(value) {
					scope.isEditing = value;
					if (value) {
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						clExplorerLayoutSvc.refreshFiles();
					}
				};
			}
		};
	})
	.directive('clPublicFileEntry', function() {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/publicFileEntry.html',
			link: function(scope) {
				scope.open = function() {
					scope.setCurrentFile(scope.fileDao);
				};
			}
		};
	})
	.directive('clClasseurEntry', function(clClasseurSvc) {
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/classeurEntry.html',
			link: function(scope, element) {
				var nameInput = element[0].querySelector('.name textarea');
				nameInput.addEventListener('keydown', function(e) {
					if (e.which === 27 || e.which === 13) {
						// Esc key
						nameInput.blur();
					}
				});
				scope.open = function() {
					!scope.isEditing && scope.setClasseur(scope.classeur);
				};
				scope.setEditing = function(value) {
					scope.isEditing = value;
					if (value) {
						setTimeout(function() {
							nameInput.focus();
						}, 10);
					} else {
						scope.classeur.name = scope.classeur.name || 'Untitled';
						clClasseurSvc.init();
					}
				};
				element[0].querySelector('.footer.panel').addEventListener('click', function(evt) {
					evt.stopPropagation();
				});
			}
		};
	})
	.directive('clExplorerLayout', function($window, $timeout, $mdDialog, clExplorerLayoutSvc, clDocFileSvc, clFileSvc, clFolderSvc, clClasseurSvc, clPanel) {
		var explorerMaxWidth = 740;
		var noPaddingWidth = 560;
		var hideOffsetY = 2000;
		return {
			restrict: 'E',
			templateUrl: 'core/explorerLayout/explorerLayout.html',
			link: function(scope, element) {

				var explorerPanel = clPanel(element, '.explorer.container');
				var contentPanel = clPanel(element, '.explorer.content');
				var toggleIconPanel = clPanel(element, '.toggle.icon');
				var folderContainerPanel = clPanel(element, '.folder.container');

				function updateLayout() {
					var explorerWidth = document.body.clientWidth;
					var containerPadding = 12;
					var noPadding = true;
					if (explorerWidth > noPaddingWidth) {
						containerPadding = 50;
						noPadding = false;
					}
					if (explorerWidth > explorerMaxWidth) {
						explorerWidth = explorerMaxWidth;
					}
					clExplorerLayoutSvc.explorerWidth = explorerWidth;
					clExplorerLayoutSvc.containerPadding = containerPadding;
					clExplorerLayoutSvc.noPadding = noPadding;
					clExplorerLayoutSvc.folderContainerWidth = explorerWidth - containerPadding * 2 - 35;
					clExplorerLayoutSvc.contentY = clExplorerLayoutSvc.isExplorerOpen ? 0 : hideOffsetY;
				}

				var isInited;

				function animateLayout() {
					updateLayout();
					explorerPanel
						.width(clExplorerLayoutSvc.explorerWidth)
						.move().x(-clExplorerLayoutSvc.explorerWidth / 2 - 44).end();
					contentPanel
						.move(isInited && 'sslow').y(clExplorerLayoutSvc.contentY).ease(clExplorerLayoutSvc.isExplorerOpen ? 'out' : 'in').end();
					folderContainerPanel
						.width(clExplorerLayoutSvc.folderContainerWidth)
						.marginLeft(clExplorerLayoutSvc.containerPadding)
						.$elt.toggleClass('no-padding', clExplorerLayoutSvc.noPadding);
					toggleIconPanel.css().move(isInited && 'sslow').rotate(clExplorerLayoutSvc.isExplorerOpen ? 0 : -90).end();
					isInited = true;
				}

				window.addEventListener('resize', animateLayout);
				scope.$on('$destroy', function() {
					window.removeEventListener('resize', animateLayout);
				});

				function setPlasticClass() {
					scope.plasticClass = 'plastic';
					if (clExplorerLayoutSvc.currentFolderDao) {
						var index = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao);
						scope.plasticClass = 'plastic-' + ((index + 1) % 4);
					}
				}

				scope.folderNameModified = function() {
					clExplorerLayoutSvc.currentFolderDao.name = clExplorerLayoutSvc.currentFolderDao.name || 'Untitled';
					clExplorerLayoutSvc.refreshFolders();
					setPlasticClass();
				};

				function onCompleteFocus(cb) {
					return function(scope, element) {
						scope.ok = function() {
							if (!scope.name) {
								return scope.focus();
							}
							$mdDialog.hide(scope.name);
						};
						scope.cancel = function() {
							$mdDialog.cancel();
						};
						var inputElt = element[0].querySelector('input');
						inputElt.addEventListener('keydown', function(e) {
							// Check enter key
							if (e.which === 13) {
								e.preventDefault();
								scope.ok();
							}
						});
						scope.focus = function() {
							setTimeout(function() {
								inputElt.focus();
							}, 10);
						};
						scope.focus();
						cb && cb(scope, element);
					};
				}

				function createFolder() {
					$mdDialog.show({
						templateUrl: 'core/explorerLayout/newFolderDialog.html',
						onComplete: onCompleteFocus()
					}).then(function(name) {
						var folderDao = clFolderSvc.createFolder();
						folderDao.name = name;
						clExplorerLayoutSvc.currentClasseurDao.folderIds.push(folderDao.id);
						$timeout(function() {
							clExplorerLayoutSvc.setCurrentFolder(folderDao);
						});
					});
				}

				scope.createFile = function() {
					$mdDialog.show({
						templateUrl: 'core/explorerLayout/newFileDialog.html',
						onComplete: onCompleteFocus()
					}).then(function(name) {
						var fileDao = clFileSvc.createFile();
						fileDao.name = name;
						if (clExplorerLayoutSvc.currentFolderDao) {
							fileDao.folderId = clExplorerLayoutSvc.currentFolderDao.id;
						}
						scope.setCurrentFile(fileDao);
						clExplorerLayoutSvc.refreshFiles();
					});
				};

				scope.setFolder = function(folder) {
					if (folder === clExplorerLayoutSvc.createFolder) {
						return createFolder();
					}
					clExplorerLayoutSvc.setCurrentFolder(folder);
				};

				scope.selectAll = function() {
					clExplorerLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = true;
					});
				};

				scope.selectNone = function() {
					clExplorerLayoutSvc.files.forEach(function(fileDao) {
						fileDao.isSelected = false;
					});
				};

				scope.hasSelection = function() {
					return clExplorerLayoutSvc.files.some(function(fileDao) {
						return fileDao.isSelected;
					});
				};

				scope.deleteConfirm = function(deleteFolder) {
					deleteFolder && scope.selectAll();
					var filesToRemove = clExplorerLayoutSvc.files.filter(function(fileDao) {
						return fileDao.isSelected;
					});

					function remove() {
						clFileSvc.removeFiles(filesToRemove);
						if (deleteFolder && clFolderSvc.removeFolder(clExplorerLayoutSvc.currentFolderDao) >= 0) {
							var newIndex = clExplorerLayoutSvc.folders.indexOf(clExplorerLayoutSvc.currentFolderDao) - 1;
							var currentFolderDao = clExplorerLayoutSvc.folders[newIndex] || clExplorerLayoutSvc.unclassifiedFolder;
							clExplorerLayoutSvc.setCurrentFolder(currentFolderDao);
						}
					}
					if (!filesToRemove.length) {
						// No confirmation
						return remove();
					}
					var title = deleteFolder ? 'Delete folder' : 'Delete files';
					var confirm = $mdDialog.confirm()
						.title(title)
						.ariaLabel(title)
						.content('You\'re about to delete ' + filesToRemove.length + ' file(s). Are you sure?')
						.ok('Delete')
						.cancel('Cancel');
					$mdDialog.show(confirm).then(remove);
				};

				scope.createClasseur = function() {
					$mdDialog.show({
						templateUrl: 'core/explorerLayout/newClasseurDialog.html',
						onComplete: onCompleteFocus()
					}).then(function(name) {
						var classeurDao = clClasseurSvc.createClasseur(name);
						scope.setClasseur(classeurDao);
					});
				};

				scope.deleteClasseur = function(classeurDao) {
					var filesToRemove = [];
					var foldersToRemove = classeurDao.folders.filter(function(folderDao) {
						if (!clClasseurSvc.classeurs.some(function(otherClasseurDao) {
								return otherClasseurDao !== classeurDao && otherClasseurDao.folders.indexOf(folderDao) !== -1;
							})) {
							filesToRemove = filesToRemove.concat(clExplorerLayoutSvc.files.filter(function(fileDao) {
								return fileDao.folderId === folderDao.id;
							}));
							return true;
						}
					});

					function remove() {
						clClasseurSvc.removeClasseur(classeurDao);
					}

					if (!foldersToRemove.length) {
						return remove();
					}

					$mdDialog.show({
						templateUrl: 'core/explorerLayout/deleteClasseurDialog.html',
						onComplete: function(scope) {
							scope.remove = function() {
								clFileSvc.removeFiles(filesToRemove);
								clFolderSvc.removeFolders(foldersToRemove);
								$mdDialog.hide();
							};
							scope.move = function() {
								$mdDialog.hide();
							};
							scope.cancel = function() {
								$mdDialog.cancel();
							};
						}
					}).then(remove);
				};

				scope.setClasseur = function(classeurDao) {
					clExplorerLayoutSvc.setCurrentClasseur(classeurDao);
					clExplorerLayoutSvc.refreshFolders();
					clExplorerLayoutSvc.toggleExplorer(true);
				};

				scope.$watch('explorerLayoutSvc.currentFolderDao', function() {
					clExplorerLayoutSvc.refreshFiles();
					scope.selectNone();
					setPlasticClass();
				});
				scope.$watch('explorerLayoutSvc.currentClasseurDao', setPlasticClass);

				scope.$watch('explorerLayoutSvc.isExplorerOpen', animateLayout);
				scope.$watch('fileSvc.files', clExplorerLayoutSvc.refreshFiles);
				scope.$watch('folderSvc.folders', function() {
					clClasseurSvc.init();
					clExplorerLayoutSvc.refreshFolders();
				});
				scope.$watch('classeurSvc.classeurs.length', clExplorerLayoutSvc.refreshFolders);
				scope.$on('$destroy', function() {
					clExplorerLayoutSvc.clean();
				});
			}
		};
	})
	.factory('clExplorerLayoutSvc', function($rootScope, clFolderSvc, clFileSvc, clClasseurSvc) {
		var lastClasseurKey = 'lastClasseurId';
		var lastFolderKey = 'lastFolderId';

		var unclassifiedFolder = {
			name: 'Unclassified'
		};
		var createFolder = {
			name: 'Create folder'
		};
		var isInited;

		function refreshFolders() {
			setCurrentClasseur(isInited ? clExplorerLayoutSvc.currentClasseurDao : clClasseurSvc.classeurMap[localStorage[lastClasseurKey]]);
			clExplorerLayoutSvc.folders = clExplorerLayoutSvc.currentClasseurDao.folders.slice().sort(function(folder1, folder2) {
				return folder1.name.toLowerCase() > folder2.name.toLowerCase();
			});
			clExplorerLayoutSvc.folders.unshift(unclassifiedFolder);
			clExplorerLayoutSvc.folders.push(createFolder);
			setCurrentFolder(isInited ? clExplorerLayoutSvc.currentFolderDao : clFolderSvc.folderMap[localStorage[lastFolderKey]]);
			isInited = true;
		}

		function refreshFiles() {
			clExplorerLayoutSvc.files = clExplorerLayoutSvc.currentFolderDao ? clFileSvc.files.filter(
				clExplorerLayoutSvc.currentFolderDao === unclassifiedFolder ? function(fileDao) {
					return !fileDao.userId && !clFolderSvc.folderMap.hasOwnProperty(fileDao.folderId);
				} : function(fileDao) {
					return !fileDao.userId && fileDao.folderId === clExplorerLayoutSvc.currentFolderDao.id;
				}) : clFileSvc.localFiles.slice();
			clExplorerLayoutSvc.files.sort(
				clExplorerLayoutSvc.currentFolderDao ? function(fileDao1, fileDao2) {
					return fileDao1.name > fileDao2.name;
				} : function(fileDao1, fileDao2) {
					return fileDao1.contentDao.lastChange < fileDao2.contentDao.lastChange;
				});
		}

		function setCurrentClasseur(classeurDao) {
			classeurDao = (classeurDao && clClasseurSvc.classeurMap[classeurDao.id]) || clClasseurSvc.defaultClasseur;
			clExplorerLayoutSvc.currentClasseurDao = classeurDao;
			localStorage.setItem(lastClasseurKey, classeurDao.id);
		}

		function setCurrentFolder(folderDao) {
			folderDao = folderDao === unclassifiedFolder ? folderDao : (folderDao && clFolderSvc.folderMap[folderDao.id]);
			if (folderDao && folderDao !== unclassifiedFolder && clExplorerLayoutSvc.currentClasseurDao.folders.indexOf(folderDao) === -1) {
				folderDao = undefined;
			}
			clExplorerLayoutSvc.currentFolderDao = folderDao;
			(folderDao && folderDao.id) ? localStorage.setItem(lastFolderKey, folderDao.id): localStorage.removeItem(lastFolderKey);
		}

		var clExplorerLayoutSvc = {
			folders: [],
			files: [],
			unclassifiedFolder: unclassifiedFolder,
			createFolder: createFolder,
			refreshFolders: refreshFolders,
			refreshFiles: refreshFiles,
			setCurrentClasseur: setCurrentClasseur,
			setCurrentFolder: setCurrentFolder,
			init: function() {
				this.isExplorerOpen = true;
			},
			clean: function() {
				clExplorerLayoutSvc.sharingDialogFileDao = undefined;
			},
			toggleExplorer: function(isOpen) {
				this.isExplorerOpen = isOpen === undefined ? !this.isExplorerOpen : isOpen;
			}
		};

		return clExplorerLayoutSvc;
	});
