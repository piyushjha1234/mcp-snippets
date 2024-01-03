// event dispatcher to track page load
window.addEventListener('load', () => {
	const customEvent = new Event('mcpPageLoaded');
	document.body.dispatchEvent(customEvent);
});

// Sitemap utility object
const SitemapUtility = {
	// // is match condition
	// isMatchCondition: function (pageType) {
	// 	return new Promise((resolve) => {
	// 		SalesforceInteractions.listener('mcpPageLoaded', 'body', () => {
	// 			console.log('page completely loaded');
	// 			clearInterval(isMatchInterval);
	// 			resolve(false);
	// 		});
	// 		// setTimeout(() => {
	// 		// 	clearInterval(isMatchInterval);
	// 		// 	resolve(false);
	// 		// }, 10000);
	// 		let iterator = 0;
	// 		const isMatchInterval = setInterval(() => {
	// 			try {
	// 				if (window.dataLayer.length > 0) {
	// 					if (window.dataLayer[iterator].event === 'core-pageview') {
	// 						const onPage = window.dataLayer[iterator].pageinfo ? window.dataLayer[iterator].pageinfo.page_type : undefined;
	// 						clearInterval(isMatchInterval);
	// 						resolve(onPage === pageType);
	// 					} else {
	// 						iterator += 1;
	// 					}
	// 				}
	// 			} catch (err) {
	// 				sendLogs('isMatch condition failed', err);
	// 				resolve(false);
	// 			}
	// 		}, 1000);
	// 	});
	// },
	// wait for DOM element to load
	waitForDOMElement: function (selector) {
		return new Promise((resolve) => {
			SalesforceInteractions.listener('mcpPageLoaded', 'body', () => {
				console.log('page completely loaded');
				clearInterval(isMatchInterval);
				resolve(false);
			});
			// setTimeout(() => {
			// 	clearInterval(elementTimer);
			// 	resolve(false);
			// }, 10000);
			let elementTimer = setInterval(() => {
				try {
					if (SalesforceInteractions.cashDom(selector).length) {
						clearInterval(elementTimer);
						resolve(true);
					}
				} catch (err) {
					sendLogs('wait for DOM element failed', err);
					resolve(false);
				}
			}, 1000);
		});
	},

	// function to check if any specific element in the dataLayer has loaded
	waitForArrayObject: function (object, eventName) {
		return new Promise((resolve) => {
			SalesforceInteractions.listener('mcpPageLoaded', 'body', () => {
				console.log('page completely loaded');
				clearInterval(isMatchInterval);
				resolve(false);
			});
			// setTimeout(() => {
			// 	clearInterval(interval);
			// 	resolve(false);
			// }, 7500);
			let iterator = 0;
			const interval = setInterval(() => {
				console.log(iterator);
				if (object.length > 0) {
					if (object[iterator]) {
						if (object[iterator].event === eventName) {
							clearInterval(interval);
							resolve(object[iterator]);
						} else {
							iterator += 1;
						}
					}
				}
			}, 250);
		});
	},
	// triggers the event in the event stream
	sendEventDetails: function (action, payload) {
		SalesforceInteractions.sendEvent({
			interaction: { name: action },
			user: payload,
		});
	},
	// logs error in the SFMC DE
	logError: function (errorMessage, errorDescription) {
		const apiURL = 'https://cloud.e.yankeecandle.com/errorLogs';
		const pageURL = window.location.href;
		const userId = SalesforceInteractions.getAnonymousId();
		const requestOptions = {
			method: 'GET',
			redirect: 'follow',
		};

		fetch(`${apiURL}?em=${errorMessage}&ed=${errorDescription}&url=${pageURL}&id=${userId}`, requestOptions)
			.then((response) => response.text())
			.then((result) => console.log('MCP Error', result))
			.catch((error) => console.log('error', error));
	},
};

SalesforceInteractions.init({
	cookieDomain: 'domain.com',
}).then(() => {
	try {
		const config = {
			// Global
			global: {
				onActionEvent: (actionEvent) => {
					console.log(actionEvent);
					return actionEvent;
				},
				contentZones: [{ name: 'global contentZone', selector: '.content-zone' }],
				listeners: [
					SalesforceInteractions.listener('click', 'button.add-to-cart', (e) => {
						try {
							let lineItem = {};
							if (SalesforceInteractions.getSitemapResult().currentPage.source.pageType !== 'product_detail_page') {
								lineItem = {
									catalogObjectType: 'Product',
									catalogObjectId: SalesforceInteractions.cashDom(e.currentTarget).attr('data-pid'),
									price:
										SalesforceInteractions.cashDom(e.currentTarget)
											.closest('div.product-tile')
											.find('span.sales span.onetime-price')
											.attr('data-price-value') || '10.0',
									quantity: Number(SalesforceInteractions.cashDom(e.currentTarget).closest('div.product-tile').find('select.plp-quantity-select').val()) || 1,
								};
							} else {
								lineItem = SalesforceInteractions.mcis.buildLineItemFromPageState('select.quantity-select option:checked');
							}

							SalesforceInteractions.sendEvent({
								interaction: {
									name: SalesforceInteractions.CartInteractionName.AddToCart,
									lineItem: lineItem,
								},
							});
						} catch (err) {
							sendLogs('add to cart failed', err);
						}
					}),
				],
			},
			// PageTypes
			pageTypes: [
				// PDP
				{
					name: 'product_detail_page',
					isMatch: () => isMatchCondition('PDP'),
					interaction: {
						name: SalesforceInteractions.CatalogObjectInteractionName.ViewCatalogObject,
						catalogObject: {
							type: 'Product',
							id: () => {
								try {
									const productId = window.location.pathname.split('/').slice(-1)[0].replace('.html', '').toUpperCase();
									return productId;
								} catch (err) {
									sendLogs('capturing product_id failed on PDP', err);
									return 'TEST_PRODUCT';
								}
							},
							attributes: {
								price: waitForElement('span.onetime-price').then(() => {
									try {
										const price = SalesforceInteractions.cashDom('span.onetime-price').attr('data-price-value');
										return price;
									} catch (err) {
										sendLogs('capturing price failed on PDP', err);
										return '10.0';
									}
								}),
								numRatings: waitForElement('.bv_numReviews_text').then(() => {
									try {
										const numRating = SalesforceInteractions.cashDom('.bv_numReviews_text').text().trim().replaceAll('(', '').replaceAll(')', '');
										return numRating;
									} catch (err) {
										sendLogs('capturing numRatings failed on PDP', err);
										return '';
									}
								}),
								rating: waitForElement('.bv_avgRating_component_container').then(() => {
									try {
										const rating = SalesforceInteractions.cashDom('.bv_avgRating_component_container').text().trim();
										return rating;
									} catch (err) {
										sendLogs('capturing rating failed on PDP', err);
										return '';
									}
								}),
							},
							relatedCatalogObjects: {
								Category: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const cat1 =
											object.pageinfo.hierarchy_sub_category1 !== '' ? object.pageinfo.hierarchy_sub_category1.trim().toUpperCase() : 'TEST_CATEGORY';
										const cat2 = object.pageinfo.hierarchy_sub_category2 !== '' ? '|' + object.pageinfo.hierarchy_sub_category2.trim().toUpperCase() : '';
										const cat3 = object.pageinfo.hierarchy_sub_category3 !== '' ? '|' + object.pageinfo.hierarchy_sub_category3.trim().toUpperCase() : '';
										const cat4 = object.pageinfo.hierarchy_sub_category4 !== '' ? '|' + object.pageinfo.hierarchy_sub_category4.trim().toUpperCase() : '';

										const category = cat1 + cat2 + cat3 + cat4;
										return [category];
									} catch (err) {
										sendLogs('capturing category failed on PDP', err);
										return [];
									}
								}),
								HierarchySubCategoryOne: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category1.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-1 failed on PDP', err);
										return [];
									}
								}),
								HierarchySubCategoryTwo: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category2.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-2 failed on PDP', err);
										return [];
									}
								}),
								HierarchySubCategoryThree: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category3.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-3 failed on PDP', err);
										return [];
									}
								}),
								HierarchySubCategoryFour: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category4.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-4 failed on PDP', err);
										return [];
									}
								}),
							},
						},
					},
					listeners: [
						SalesforceInteractions.listener(
							'mouseup.initComparisonShopping touchend.initComparisonShopping',
							'h1.product-name',
							SalesforceInteractions.ComparisonShopping.handleComparisonShopping,
						),
					],
				},
				// PLP
				{
					name: 'category_page',
					isMatch: () => isMatchCondition('PLP'),
					interaction: {
						name: SalesforceInteractions.CatalogObjectInteractionName.ViewCatalogObject,
						catalogObject: {
							type: 'Category',
							id: () =>
								waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const cat1 =
											object.pageinfo.hierarchy_sub_category1 !== '' ? object.pageinfo.hierarchy_sub_category1.trim().toUpperCase() : 'TEST_CATEGORY';
										const cat2 = object.pageinfo.hierarchy_sub_category2 !== '' ? '|' + object.pageinfo.hierarchy_sub_category2.trim().toUpperCase() : '';
										const cat3 = object.pageinfo.hierarchy_sub_category3 !== '' ? '|' + object.pageinfo.hierarchy_sub_category3.trim().toUpperCase() : '';
										const cat4 = object.pageinfo.hierarchy_sub_category4 !== '' ? '|' + object.pageinfo.hierarchy_sub_category4.trim().toUpperCase() : '';

										const category = cat1 + cat2 + cat3 + cat4;
										return category;
									} catch (err) {
										sendLogs('capturing category id failed on PLP', err);
										return 'TEST_CATEGORY';
									}
								}),
							relatedCatalogObjects: {
								HierarchySubCategoryOne: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category1.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-1 failed on PLP', err);
										return [];
									}
								}),
								HierarchySubCategoryTwo: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category2.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-1 failed on PLP', err);
										return [];
									}
								}),
								HierarchySubCategoryThree: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category3.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-1 failed on PLP', err);
										return [];
									}
								}),
								HierarchySubCategoryFour: waitForObject(window.dataLayer, 'core-pageview').then((object) => {
									try {
										const rco = object.pageinfo.hierarchy_sub_category4.trim().toUpperCase();
										return [rco];
									} catch (err) {
										sendLogs('capturing HSC-1 failed on PLP', err);
										return [];
									}
								}),
							},
						},
					},
				},
				// Cart
				{
					name: 'cart_page',
					isMatch: () => /\/cart/.test(window.location.pathname),
					interaction: {
						name: SalesforceInteractions.CartInteractionName.ReplaceCart,
						lineItems: () =>
							waitForElement('.checkout-btn').then((status) => {
								let cartLineItems = [];
								if (status) {
									SalesforceInteractions.cashDom('.product-grouping .card.product-info').each((index, ele) => {
										try {
											const lineItem = {
												catalogObjectType: 'Product',
												catalogObjectId: SalesforceInteractions.cashDom(ele).attr('data-sku').trim().toUpperCase(),
												price: SalesforceInteractions.cashDom(ele).attr('data-price').trim(),
												quantity: SalesforceInteractions.cashDom(ele).find('select.quantity ').val(),
											};
											cartLineItems.push(lineItem);
										} catch (err) {
											sendLogs('capturing lineItem failed on cart page', err);
										}
									});
								}
								return cartLineItems;
							}),
					},
					listeners: [
						SalesforceInteractions.listener('click', 'button.cart-delete-confirmation-btn', () => {
							setTimeout(() => {
								SalesforceInteractions.reinit();
							}, 5000);
						}),
						SalesforceInteractions.listener('click', ' button.move-to-cart', () => {
							sendUserDetails('Move to Cart', {});
						}),
						SalesforceInteractions.listener('click', 'button.add-to-wish-list', () => {
							sendUserDetails('Save For Later', {});
						}),
					],
				},
				// Checkout
				{
					name: 'checkout_page',
					isMatch: () => /\/checkout/.test(window.location.pathname),
					interaction: {
						name: 'Checkout Page View',
					},
					listeners: [
						SalesforceInteractions.listener('click', '#form-submit', () => {
							try {
								const firstName = SalesforceInteractions.cashDom('#shippingfirstName').length
									? SalesforceInteractions.cashDom('#shippingfirstName').val().trim()
									: '';
								const lastName = SalesforceInteractions.cashDom('#shippinglastName').length
									? SalesforceInteractions.cashDom('#shippinglastName').val().trim()
									: '';
								const email = SalesforceInteractions.cashDom('#guestEmail').length ? SalesforceInteractions.cashDom('#guestEmail').val().trim() : '';
								const phoneNumber = SalesforceInteractions.cashDom('#shippingphone').length
									? SalesforceInteractions.cashDom('#shippingphone').val().trim()
									: '';
								if (email && /^.+@.+\..+$/.test(email)) {
									let userDetails = {
										identities: {
											email: email,
											emailAddress: email,
										},
										attributes: {},
									};
									if (phoneNumber) userDetails.attributes['phone'] = phoneNumber;
									if (firstName) userDetails.attributes['firstName'] = firstName;
									if (lastName) userDetails.attributes['lastName'] = lastName;

									sendUserDetails('Guest Checkout', userDetails);
								}
							} catch (err) {
								sendLogs('capturing form-data failed on checkout page', err);
							}
						}),
						SalesforceInteractions.listener('click', '.signin-btn.login-submit-btn', () => {
							try {
								const email = SalesforceInteractions.cashDom('#login-form-email').length
									? SalesforceInteractions.cashDom('#login-form-email').val().trim()
									: '';
								if (email && /^.+@.+\..+$/.test(email)) {
									let userDetails = {
										identities: {
											email: email,
											emailAddress: email,
										},
									};
									sendUserDetails('Checkout Log In', userDetails);
								}
							} catch (err) {
								sendLogs('capturing login email address failed on checkout page', err);
							}
						}),
					],
				},
				// Order Confirmation
				{
					name: 'order_confirmation_page',
					isMatch: () => /\/Order-Confirm/.test(window.location.pathname),
					interaction: {
						name: SalesforceInteractions.OrderInteractionName.Purchase,
						order: {
							id: waitForObject(window.dataLayer, 'transaction').then((object) => {
								try {
									if (object) {
										const orderId = object.ecommerce.purchase.actionField.id;
										return orderId;
									}
								} catch (err) {
									sendLogs('capturing orderId failed on order confirmation page', err);
									return 'order-' + new Date().valueOf().toString();
								}
							}),
							lineItems: () =>
								waitForObject(window.dataLayer, 'transaction').then((object) => {
									let purchaseLineItems = [];

									if (object) {
										const productArray = object.ecommerce.purchase.products;
										productArray.forEach((ele) => {
											try {
												const lineItem = {
													catalogObjectType: 'Product',
													catalogObjectId: ele.product_sku.trim().toUpperCase(),
													price: ele.price.trim(),
													quantity: ele.quantity,
												};
												purchaseLineItems.push(lineItem);
											} catch (err) {
												sendLogs('capturing order lineitems failed on order confirmation page', err);
											}
										});
									}

									return purchaseLineItems;
								}),
						},
					},
				},
				// Home
				{
					name: 'home_page',
					isMatch: () => window.location.pathname === '/',
					interaction: {
						name: 'Home Page View',
					},
					contentZones: [
						{ name: 'home_hero', selector: '.banner-container[data-pd-element-selector=banner]:nth-of-type(1)' },
						{ name: 'prod_rec', selector: 'div.experience-commerce_assets-productCarousel' },
						{ name: 'home_masonry', selector: '.masonry-brick' },
					],
				},
				// Personalized Candle
				{
					name: 'personalized_candles_landing_page',
					isMatch: () => /\/personalize-candles/.test(window.location.pathname),
					interaction: {
						name: 'Personalized Candles Landing Page View',
					},
				},
				// Gift Card
				{
					name: 'gift_card_page',
					isMatch: () => /\/giftcards/.test(window.location.pathname),
					interaction: {
						name: 'Gift Card Page View',
					},
				},
				// Search
				{
					name: 'search_page',
					isMatch: () => /\/search/.test(window.location.pathname),
					interaction: {
						name: 'Search Page View',
					},
					onActionEvent: (actionEvent) => {
						const searchTerm = new URLSearchParams(window.location.search).get('q');
						if (searchTerm) {
							actionEvent.user = actionEvent.user || {};
							actionEvent.user.attributes = actionEvent.user.attributes || {};
							actionEvent.user.attributes.lastSearchTerm = searchTerm;
						}
						return actionEvent;
					},
				},
				// Login
				{
					name: 'login_page',
					isMatch: () => /\/login/.test(window.location.pathname),
					interaction: {
						name: 'Login Page View',
					},
					listeners: [
						SalesforceInteractions.listener('click', "form[name='dwfrm_profile'] button", () => {
							try {
								const email = SalesforceInteractions.cashDom('#registration-form-email').length
									? SalesforceInteractions.cashDom('#registration-form-email').val().trim()
									: undefined;
								const firstName = SalesforceInteractions.cashDom('#registration-form-fname').length
									? SalesforceInteractions.cashDom('#registration-form-fname').val().trim()
									: '';
								const lastName = SalesforceInteractions.cashDom('#registration-form-lname').length
									? SalesforceInteractions.cashDom('#registration-form-lname').val().trim()
									: '';

								if (email && /^.+@.+\..+$/.test(email)) {
									let userDetails = {
										identities: {
											email: email,
											emailAddress: email,
										},
										attributes: {},
									};
									if (firstName) userDetails.attributes['firstName'] = firstName;
									if (lastName) userDetails.attributes['lastName'] = lastName;

									sendUserDetails('Create Account Attempt', userDetails);
								}
							} catch (err) {
								sendLogs('capturing email failed while account creation', err);
							}
						}),
						SalesforceInteractions.listener('click', "form[name='login-form'] button", () => {
							try {
								const email = SalesforceInteractions.cashDom('#login-form-email').length
									? SalesforceInteractions.cashDom('#login-form-email').val().trim()
									: undefined;
								if (email && /^.+@.+\..+$/.test(email)) {
									let userDetails = {
										identities: {
											email: email,
											emailAddress: email,
										},
										attributes: {},
									};
									sendUserDetails('Log In Attempt', userDetails);
								}
							} catch (err) {
								sendLogs('capturing email failed while login', err);
							}
						}),
					],
				},
				// Account
				{
					name: 'account_page',
					isMatch: () => /\/account/.test(window.location.pathname),
					interaction: {
						name: 'Account Page View',
					},
					listeners: [
						SalesforceInteractions.listener('mcpPageLoaded', 'body', () => {
							try {
								const contactID = window.userData ? window.userData.contactId : undefined;
								const firstName = SalesforceInteractions.cashDom('.first-name .value').length
									? SalesforceInteractions.cashDom('.first-name .value').text().trim()
									: '';
								const lastName = SalesforceInteractions.cashDom('.last-name .value').length
									? SalesforceInteractions.cashDom('.last-name .value').text().trim()
									: '';
								let userDetails = {
									attributes: {},
								};
								if (contactID) userDetails.attributes['contactId'] = contactID;
								if (contactID) userDetails.attributes['sfmcContactKey'] = contactID;
								if (firstName) userDetails.attributes['firstName'] = firstName;
								if (lastName) userDetails.attributes['lastName'] = lastName;

								sendUserDetails('Log In Success', userDetails);
							} catch (err) {
								sendLogs('capturing details failed on account page', err);
							}
						}),
					],
				},
				// Contact Us
				{
					name: 'contact_us_page',
					isMatch: () => /\/contact-us/.test(window.location.pathname),
					interaction: {
						name: 'Contact Us Page View',
					},
					listeners: [
						SalesforceInteractions.listener('click', '#form-submit', () => {
							try {
								const firstName = SalesforceInteractions.cashDom('#contactus-firstName').length
									? SalesforceInteractions.cashDom('#contactus-firstName').val().trim()
									: '';
								const lastName = SalesforceInteractions.cashDom('#contactus-lastName').length
									? SalesforceInteractions.cashDom('#contactus-lastName').val().trim()
									: '';
								const email = SalesforceInteractions.cashDom('#contactus-email').length ? SalesforceInteractions.cashDom('#contactus-email').val().trim() : '';
								const phoneNumber = SalesforceInteractions.cashDom('#contactus-phoneNumber').length
									? SalesforceInteractions.cashDom('#contactus-phoneNumber').val().trim()
									: '';
								if (email && /^.+@.+\..+$/.test(email)) {
									let userDetails = {
										identities: {
											email: email,
											emailAddress: email,
										},
										attributes: {},
									};
									if (phoneNumber) userDetails.attributes['phone'] = phoneNumber;
									if (firstName) userDetails.attributes['firstName'] = firstName;
									if (lastName) userDetails.attributes['lastName'] = lastName;

									sendUserDetails('Contact Us Form Submit', userDetails);
								}
							} catch (err) {
								sendLogs('capturing details failed on contact us form submission', err);
							}
						}),
					],
				},
				// Product Registration
				{
					name: 'product_registration_page',
					isMatch: () => /\/product-registration/.test(window.location.pathname),
					interaction: {
						name: 'Product Registration Page View',
					},
				},
				// Error
				{
					name: 'error_page',
					isMatch: () => isMatchCondition('Error Page'),
					interaction: {
						name: 'Error Page View',
					},
				},
			],
			// Default
			pageTypeDefault: {
				name: 'default_page',
				interaction: {
					name: 'Default Page',
				},
			},
		};
		SalesforceInteractions.initSitemap(config);
	} catch (err) {
		const fallbackConfig = {
			global: {
				contentZones: [
					{ name: 'global_masterCZ' },
					{ name: 'global_popup' },
					{ name: 'global_popup_2' },
					{ name: 'global_toast' },
					{ name: 'global_data_capture' },
					{ name: 'site_stripe' },
					{ name: 'footer_signup_v2', selector: '.email-input-parent' },
					{ name: 'mcp_trends' },
				],
			},
			pageTypes: [
				{
					name: 'fallback_page',
					isMatch: () => true,
					interaction: {
						name: 'Fallback Event',
					},
				},
			],
		};
		SalesforceInteractions.initSitemap(fallbackConfig);
		sendLogs('fallback sitemap triggered', err);
	}
});
