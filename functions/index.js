const functions = require("firebase-functions");
const firebase = require("firebase-admin");
const auth = require("@firebase/auth");
firebase.initializeApp({
    credential: firebase.credential.applicationDefault(),
});
const messaging = firebase.messaging();
var firestore = firebase.firestore();
firestore.settings({
    timestampsInSnapshots: true
});
var moment = require('moment-timezone');
var TIMEZONE_NAME = 'America/Sao_Paulo';
moment.locale('pt-br');
moment.tz.setDefault(TIMEZONE_NAME);
const Stripe = require('stripe');
const stripe = Stripe('sk_test_51J5XWyIV6LxNQN3KFlfOW25z2y0iV2KyjgL5nl1SL6xT0gNw68wkf1vX54TjhmBkTHDbIgw1TfJAx7EXSIWa3bKB00qtFjo12j');

exports.createCoupon = functions.https.onCall(async (data, context) => {
    // Função para criar cupons.
    console.log("data.allCustomers: ", data.allCustomers);    

    if(data.allCustomers){
        var customerIdWithErrorList = [];

        const customersQuery = await firestore.collection("customers").where("status", "==", "ACTIVE").get();

        for (let index = 0; index < customersQuery.docs.length; index++) {
            const customerDoc = customersQuery.docs[index];
            
            try {
                const couponRef = await customerDoc.ref.collection('active_coupons').add(data.couponObj);
                await couponRef.update({
                    guest_id: customerDoc.id,
                    // user_id: "scorefy",
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    id: couponRef.id,
                });

                const couponDoc = await couponRef.get();

                firestore.collection("coupons").doc(couponRef.id).set(couponDoc.data());
            } catch (error) {
                console.log(error);
                customerIdWithErrorList.push(customerDoc.id);
            }            
        }

        console.log("customerIdWithErrorList.length != 0: ", customerIdWithErrorList.length != 0);

        return {
            status: "SUCCESS",
            errorCode: null,
            message: "Cupons criados com sucesso",
            hasError: customerIdWithErrorList.length != 0,
            customerIdWithErrorList: customerIdWithErrorList,
        }
    } else {
        const customerIdList = data.customerIdList;

        console.log("customerIdList.length: ", customerIdList.length);
        if(customerIdList.length != 0){        
            var customerIdWithErrorList = [];
    
            for (let index = 0; index < customerIdList.length; index++) {
                const customerId = customerIdList[index];
                console.log("customerId", index, " == ", customerId);
                
                try {
                    const customerDoc = await firestore.collection('customers').doc(customerId).get();
                    const couponRef = await customerDoc.ref.collection('active_coupons').add(data.couponObj);
                    await couponRef.update({
                        guest_id: customerId,
                        // user_id: "scorefy",
                        created_at: firebase.firestore.FieldValue.serverTimestamp(),
                        id: couponRef.id,
                    });
                
                    const couponDoc = await couponRef.get();

                    firestore.collection("coupons").doc(couponRef.id).set(couponDoc.data());
                } catch (error) {
                    console.log(error);
                    customerIdWithErrorList.push(customerId);
                }
                
            }
    
            console.log("customerIdWithErrorList.length != 0: ", customerIdWithErrorList.length != 0);
    
            return {
                status: "SUCCESS",
                errorCode: null,
                message: "Cupons criados com sucesso",
                hasError: customerIdWithErrorList.length != 0,
                customerIdWithErrorList: customerIdWithErrorList,
            }
    
        } else {
            return {
                status: "FAILED",
                errorCode: "customerIdList is empty",
                message: "Nenhum cliente selecionado",
                hasError: true,
                customerIdWithErrorList: [],
            }
        }
    }

});

// função para ser chamada localmente.
async function sendEmailServerSide(){
    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    const msg = {
    to: 'ryanotto465@gmail.com', // Change to your recipient
    from: 'scorefyteste@gmail.com', // Change to your verified sender
    subject: 'Sending with SendGrid is Fun',
    text: 'and easy to do anywhere, even with Node.js',
    html: '<strong>and easy to do anywhere, even with Node.js</strong>',
    }

    sgMail.send(msg).then((response) => {
        console.log(response[0].statusCode)
        console.log(response[0].headers)
    }).catch((error) => {
        console.error(error)
    });
}

exports.sendEmailClientSide = functions.https.onCall(async (data, context) => {
// Função para enviar e-mails do tipo onCall, ou seja, o seu gatilho fica no client side.

    const sgMail = require('@sendgrid/mail')
    sgMail.setApiKey(process.env.SENDGRID_API_KEY)

    const msg = {
    to: 'ryanotto465@gmail.com', // Change to your recipient
    from: 'scorefyteste@gmail.com', // Change to your verified sender
    subject: 'Sending with SendGrid is Fun',
    text: 'and easy to do anywhere, even with Node.js',
    html: '<strong>and easy to do anywhere, even with Node.js</strong>',
    }

    sgMail.send(msg).then((response) => {
        console.log(response[0].statusCode)
        console.log(response[0].headers)
    }).catch((error) => {
        console.error(error)
    });
});

// Função para criar um anúncio no banco de dados.
exports.createAds = functions.https.onCall(async (data, context) => {
    // data = ads;
    // console.log("data.ads: " + data);
    let adsRef = firestore.collection("ads").doc();
    await adsRef.set(data);
    await adsRef.update({id: adsRef.id, created_at: firebase.firestore.FieldValue.serverTimestamp()});

    let adsSubRef = firestore.collection("sellers").doc(data.seller_id).collection("ads").doc(adsRef.id);
    await adsSubRef.set(data);
    await adsSubRef.update({id: adsRef.id, created_at: firebase.firestore.FieldValue.serverTimestamp()});

    return adsRef.id;
});

// função que devolve a lista de faturas disponíveis para a compra do usuário.
exports.availablePlans = functions.https.onCall(async (data, context) => {
    console.log("availablePlans: ", data.price, data.userId);
    const price = data.price;
    const userId = data.userId;
    try {
        const userDoc = await firestore.collection("customers").doc(userId).get();
        const customerId = userDoc.get("customer_id");
        const cardsQuery = await userDoc.ref.collection("cards").where("main", "==", true).get();
        const cardDoc = cardsQuery.docs[0];
        const cardId = cardDoc.get("card_id");
        const formatedPrice = new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2
        }).format(price).replace(",", "");

        const intent = await stripe.paymentIntents.create({
            amount: formatedPrice,
            currency: 'brl',
            payment_method: cardId,
            payment_method_options: {
                card: {
                    installments: {
                        enabled: true,
                    },
                },
            },
            customer: customerId,
        });

        console.log("available_plans: ", intent);

        return {
            status: "success",
            intent_id: intent.id,
            available_plans: intent.payment_method_options.card.installments.available_plans,
            error_code: null,
        };


    } catch (error) {
        console.log("xxxxxxx error: ", error.code);
        return {
            status: "error",
            intent_id: null,
            available_plans: [],
            error_code: error.code,
        };
    }
});

// Função para finalizar o pedido com implementação da cobrança no stripe.
exports.finalizeOrder = functions.https.onCall(async (data, context) => {
    const userDoc = await firestore.collection("customers").doc(data.userId).get();
    const sellerDoc = await firestore.collection("sellers").doc(data.sellerId).get();
    console.log("data.paymentMethod: ", data.paymentMethod);
    console.log("data.cardId: ", data.cardId);
    const response = await orderPayment(data.userId, data.price.totalPriceWithDiscount, sellerDoc.id, data.paymentMethod, data.cardId);

    console.log("responseresponserespnseresponseresponse ", response["code"]);

    if (response["code"] == "success") {
        const cusOrderRef = await userDoc.ref.collection("orders").add(data.order);
        await cusOrderRef.update({
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            id: cusOrderRef.id,
            code: cusOrderRef.id.substring(cusOrderRef.id.length -5, cusOrderRef.id.length),
            // price_total: data.price.totalPrice,
            // price_total_with_discount: data.price.totalPriceWithDiscount,
            // price_rate_delivery: data.price.deliveryPrice,
            // seller_id: data.sellerId,
            status: "REQUESTED",
        });

        const orderDoc = await cusOrderRef.get();

        const orderGlobalRef = firestore.collection("orders").doc(cusOrderRef.id);
        orderGlobalRef.set(orderDoc.data());

        const orderSellerRef = sellerDoc.ref.collection("orders").doc(cusOrderRef.id);
        orderSellerRef.set(orderDoc.data());

        // var totalAmount = 0;

        for (const item of data.items) {
            console.log("item: ", item);
            const adsCusRef = cusOrderRef.collection("ads").doc(item.ads_id);
            await adsCusRef.set(item);
            await adsCusRef.update({
                "created_at": firebase.firestore.FieldValue.serverTimestamp(),
                "order_id": cusOrderRef.id,
            });

            const adsRef2 = sellerDoc.ref.collection("orders").doc(cusOrderRef.id).collection("ads").doc(item.ads_id);
            await adsRef2.set(item);
            await adsRef2.update({
                "created_at": firebase.firestore.FieldValue.serverTimestamp(),
                "order_id": cusOrderRef.id,
            });

            const gloAdsRef = firestore.collection("orders").doc(cusOrderRef.id).collection("ads").doc(item.ads_id);
            await gloAdsRef.set(item);
            await gloAdsRef.update({
                "created_at": firebase.firestore.FieldValue.serverTimestamp(),
                "order_id": cusOrderRef.id,
            });

            // totalAmount += item.amount;
            // console.log("totalAmount: ", totalAmount);
        }
        // await cusOrderRef.update({
        //     total_amount: totalAmount,
        // });

        // const rateDelivery = await calculateRateDelivery(data.deliveryType);
        // priceTotal += rateDelivery;


        console.log("transactionModel ", response["transaction-model"]);
        response["transaction-model"]['order_id'] = cusOrderRef.id;
        console.log("transactionModel ", response["transaction-model"]);

        const customerTransactionRef = await userDoc.ref.collection("transactions").add(response["transaction-model"]);

        await customerTransactionRef.update({
            id: customerTransactionRef.id
        });

        const customerTransactionDoc = await customerTransactionRef.get();

        await firestore.collection("transactions").doc(customerTransactionRef.id).set(customerTransactionDoc.data());

        await sellerDoc.ref.collection("transactions").doc(customerTransactionRef.id).set(customerTransactionDoc.data());

        await sendNotification(
            data.userId,
            data.sellerId,
            "sellers",
            "Um novo pedido te esperando!",
            "customers",
        );

        sendNotificationToSupport("Um novo pedido está sendo realizado", data.userId);
        return {
            code: response["code"],
            orderId: orderDoc.id,
        };
    } else {
        return {
            code: response["code"],
            orderId: null,
        };
    }

    // return response["code"];
});

// async function calculateRateDelivery(deliveryType){
//     var price = 48;
//     if(deliveryType == "express"){
//         price = 54;
//     }
//     return price;
// }

async function orderPayment(userUid, price, sellerId, paymentMethod, cardId) {
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const userDoc = await firestore.collection("customers").doc(userUid).get();
    console.log("ccccccccccccc orderPayment", userUid, price, sellerId, paymentMethod, cardId);

    if (paymentMethod == "MONEY" || paymentMethod == "PIX" || paymentMethod == "ACCOUNT-BALANCE") {
        const transactionModel = {
            "created_at": now,
            "updated_at": now,
            "seller_id": sellerId,
            "customer_id": userUid,
            "value": price,
            "id": null,
            "payment_intent": null,
            "payment_method": paymentMethod,
            "status": "AWAITING",
        };
        if(paymentMethod == "ACCOUNT-BALANCE"){
            if(userDoc.get("account_balance") < price){
                return {
                    "code": "account-balance-insuficient",
                    "transaction-model": null
                };
            } else {
                await userDoc.ref.update({
                    account_balance: userDoc.get("account_balance") - price,
                });

                if(userDoc.get("account_balance") < 0){
                    await userDoc.ref.update({
                        account_balance: 0,
                    }); 
                }
                return {
                    "code": "success",
                    "transaction-model": transactionModel
                };
            }
        } else {
            return {
                "code": "success",
                "transaction-model": transactionModel
            };
        }
    } else if(paymentMethod == 'CARD'){    
        const formatedPrice = new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2
        }).format(price).replace(",", "").replace(".", "");

        console.log("ccccccccccccc formatedPrice", formatedPrice);


        const customerId = userDoc.get("customer_id");

        console.log("ccccccccccccc customerId", customerId);

        // const cardsQuery = await userDoc.ref.collection("cards").where("main", "==", true).get();

        // console.log("ccccccccccccc cardsQuery.docs.length", cardsQuery.docs.length);

        // const cardDoc = cardsQuery.docs[0];

        // const cardId = cardDoc.get("card_id");

        console.log("ccccccccccccc cardId", cardId);
        console.log("formatedPrice", formatedPrice);

        const param = {
            payment_method: cardId,
            payment_method_types: ['card'],
            amount: formatedPrice,
            currency: 'brl',
            customer: customerId,
            confirm: true,
            receipt_email: userDoc.get("email"),
            // payment_method_options: {
            //     card: {
            //         installments: {
            //             enabled: installmentEnabled,
            //             plan: {
            //                 "count": installmentCount,
            //                 "interval": "month",
            //                 "type": "fixed_count"
            //             },
            //         }
            //     },
            // },
        };

        try {
            const paymentIntent = await stripe.paymentIntents.create(param);

            console.log("xxxxxxxxxxxxx paymentIntent: ", paymentIntent);

            const transactionModel = {
                "created_at": now,
                "updated_at": now,
                "seller_id": sellerId,
                "customer_id": userUid,
                "value": price,
                "id": null,
                "payment_intent": paymentIntent.id,
                "payment_method": "CARD",
                "status": "PAID",
            };

            return {
                "code": "success",
                "transaction-model": transactionModel
            };
        } catch (error) {
            console.log("xxxxxxx error: ", error.code);
            return {
                "code": error.code,
                "transaction-model": null
            };
        }
    } else {
        return {
            "code": 'dont-was-selected-payment-method',
            "transaction-model": null
        }; 
    }
}

// Função para aceitar um pedido.
exports.acceptOrder = functions.https.onCall(async (order, context) => {
    let fields = {
        status: "PROCESSING",
        start_date: firebase.firestore.FieldValue.serverTimestamp(),
    };
    console.log("acceptOrder: ", order);
    await firestore.collection("orders").doc(order.id).update(fields);
    await firestore.collection("sellers").doc(order.seller_id).collection("orders").doc(order.id).update(fields);
    await firestore.collection("customers").doc(order.customer_id).collection("orders").doc(order.id).update(fields);
    sendNotification(
        order.seller_id,
        order.customer_id,
        "customers",
        "O seu pedido foi aceito.",
        "sellers",
    );
});

// Função para recusar um pedido.
exports.refuseOrder = functions.https.onCall(async (order, context) => {
    let fields = {
        status: "REFUSED",
        end_date: firebase.firestore.FieldValue.serverTimestamp(),
    };
    console.log("refuseOrder: ", order);

    await firestore.collection("orders").doc(order.id).update(fields);
    await firestore.collection("sellers").doc(order.seller_id).collection("orders").doc(order.id).update(fields);
    await firestore.collection("customers").doc(order.customer_id).collection("orders").doc(order.id).update(fields);
    sendNotification(
        order.seller_id,
        order.customer_id,
        "customers",
        "O seu pedido foi recusado.",
        "sellers",
    );
});

// Função para cancelar um pedido.
exports.cancelOrder = functions.https.onCall(async (data, context) => {
    // data = [order, userId, userCollection]
    let fields = {
        status: "CANCELED",
        end_date: firebase.firestore.FieldValue.serverTimestamp(),
        discontinued_by: data.userCollection,
        user_id_discontinued: data.userId,
    };
    console.log("cancelOrder: ", data);

    await firestore.collection("orders").doc(data.order.order_id).update(fields);
    await firestore.collection("sellers").doc(data.order.seller_id).collection("orders").doc(data.order.order_id).update(fields);
    await firestore.collection("customers").doc(data.order.customer_id).collection("orders").doc(data.order.order_id).update(fields);
    if (data.order.agent_id){
        const emiRef = firestore.collection("agents").doc(data.order.agent_id);
        await emiRef.update({mission_in_progress: null});
        await emiRef.collection("orders").doc(data.order.order_id).update(fields);
    }

    sendNotification(
        data.order.seller_id,
        data.order.customer_id,
        "customers",
        "O seu pedido foi cancelado.",
        "sellers",
    );
});

exports.requestDelivery = functions.https.onCall(async (data, context) => {
    // futuramente esta função será melhorada, ficará mais completa.
    const agents = await firestore.collection("agents").get();
    const agentDoc = agents.docs[0];

    console.log("agent id: ", agentDoc.id);

    const missionsInProgress = await agentDoc.ref.collection("orders").where("status", "in", ["DELIVERY_ACCEPTED", "DELIVERY_REQUESTED", "SENDED"]).get();

    console.log("missionsInProgress is empty ", missionsInProgress.docs.length == 0);

    if(missionsInProgress.docs.length == 0) {
        const objUpdate = {
            status: "DELIVERY_REQUESTED",
            agent_id: agentDoc.id,
        };

        await firestore.collection("orders").doc(data.orderId).update(objUpdate);   
        const orderDoc = await firestore.collection("orders").doc(data.orderId).get();
        // const orderData = orderDoc.data();

        const agentOrderRef = agentDoc.ref.collection("orders").doc(orderDoc.id);
        await agentOrderRef.set(orderDoc.data());
        
        await firestore.collection(`customers/${orderDoc.get("customer_id")}/orders`).doc(data.orderId).update(objUpdate);
        await firestore.collection(`sellers/${orderDoc.get("seller_id")}/orders`).doc(data.orderId).update(objUpdate);
    
        sendNotification(
            orderDoc.get("seller_id"),
            agentDoc.id,
            "agents",
            "Uma nova missão para você.",
            "sellers",
        );

        return {
            "status": "success",
            "code": null,
            "message": null,
        }

    } else {
        return {
            "status": "FAILED",
            "code": "without-agent",
            "message": "Nenhum agente disponível",
        }
    }
});

// Função de resposta do emissario à solicitação de envio
exports.agentResponse = functions.https.onCall(async (data, context) => {
    // data = {orderId, response}
    let orderDoc = await firestore.collection("orders").doc(data.orderId).get();

    let orderData = orderDoc.data();

    await orderDoc.ref.update(data.response)
    await firestore.collection(`customers/${orderData.customer_id}/orders`).doc(data.orderId).update(data.response);
    await firestore.collection(`sellers/${orderData.seller_id}/orders`).doc(data.orderId).update(data.response);
    await firestore.collection(`agents/${orderData.agent_id}/orders`).doc(data.orderId).update(data.response);
});

// Função para enviar um pedido.
exports.sendOrder = functions.https.onCall(async (data, context) => {
    // data = [order, token]
    console.log("sendOrder data: ", data);
    let orderDoc = await firestore.collection("orders").doc(data.order.order_id).get();
    let token = new String(orderDoc.get("agent_token"));
    let dataToken = new String(data.token);
    console.log("token: ", token, dataToken)
    console.log("token uppercase: ", token.toUpperCase(), dataToken.toUpperCase())

    if (token.toUpperCase() != dataToken.toUpperCase()) {
        return "O token fornecido não coindide";
    }

    console.log("after validation");

    const agentRef = firestore.collection("agents").doc(data.order.agent_id);
    if((await agentRef.get()).get("mission_in_progress") == null){   
        let fields = {
            agent_status: "GOING_TO_CUSTOMER",
            status: "SENDED",
            send_date: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        await orderDoc.ref.update(fields);
        await firestore.collection("sellers").doc(data.order.seller_id).collection("orders").doc(data.order.order_id).update(fields);
        await firestore.collection("customers").doc(data.order.customer_id).collection("orders").doc(data.order.order_id).update(fields);
        await agentRef.collection("orders").doc(data.order.order_id).update(fields);
        
        sendNotification(
            data.order.seller_id,
            data.order.customer_id,
            "customers",
            "O seu pedido está a caminho.",
            "sellers",
        );
    }
});

// Função para enviar um pedido.
exports.concludeOrder = functions.https.onCall(async (data, context) => {
    // data = [orderId, token]
    let orderDoc = await firestore.collection("orders").doc(data.orderId).get();

    let token = new String(orderDoc.get("customer_token"));
    let dataToken = new String(data.token);

    console.log(`token param: ${data.token}`);
    console.log(`token doc: ${token}`);

    if (token.toUpperCase() != dataToken.toUpperCase()) {
        return {
            "status": "failed",
            "status-code": "token-invalid",
            "price-rate-delivery": null,
        };
    }

    let fields = {
        agent_status: "CONCLUDED",
        status: "CONCLUDED",
        end_date: firebase.firestore.FieldValue.serverTimestamp(),
    };

    const agentRef = firestore.collection("agents").doc(orderDoc.get("agent_id"));
    await agentRef.update({mission_in_progress: null});

    await orderDoc.ref.update(fields);
    await firestore.collection("sellers").doc(orderDoc.get("seller_id")).collection("orders").doc(data.orderId).update(fields);
    await firestore.collection("customers").doc(orderDoc.get("customer_id")).collection("orders").doc(data.orderId).update(fields);
    await agentRef.collection("orders").doc(data.orderId).update(fields);

    return {
        "status": "success",
        "status-code": null,
        "price-rate-delivery": orderDoc.get("price_rate_delivery"),
    };
});

// Função para atulalizar campos em um ou mais documentos em uma coleção global e em outras sub coleções
exports.updateFields = functions.https.onCall(async (data, context) => {
    // data = [docId = str, fields = obj, collection = str, subCollectionsOf = array map[collection, docId]];
    if (data.subCollectionsOf) {
        // console.log("data.subCollectionsOf " + data.subCollectionsOf);
        for (i = 0; i < data.subCollectionsOf.length; i++) {
            let collectionOf = data.subCollectionsOf[i];
            // console.log("data.docId " + data.docId);
            // console.log("data.fields " + data.fields);
            // console.log("collectionOf.docId " + collectionOf.docId);
            // console.log("collectionOf.collection " + collectionOf["collection"]);
            await firestore.collection(collectionOf.collection).doc(collectionOf.docId).collection(data.collection).doc(data.docId).update(data.fields);
        }
        await firestore.collection(data.collection).doc(data.docId).update(data.fields);
    } else {
        await firestore.collection(data.collection).doc(data.docId).update(data.fields);
    }
});

// Função para avaliar um pedido
exports.evaluate = functions.https.onCall(async (data, context) => {

    data.ratings.forEach(async function (rating) {
        const ratGloRef = firestore.collection("ratings").doc();
        await ratGloRef.set(rating);
        await ratGloRef.update({
            id:ratGloRef.id,
            created_at:firebase.firestore.FieldValue.serverTimestamp(),
        });

        if(rating.evaluated_collection != "scorefy"){
            const ratRef = firestore.collection(rating.evaluated_collection).doc(rating.evaluated_id).collection("ratings").doc(ratGloRef.id);
            const ratGloDoc = await ratGloRef.get();
            await ratRef.set(ratGloDoc.data());
        }
    });

    const orderDoc = await firestore.collection("orders").doc(data.ratings[0].order_id).get();

    console.log("customer " + orderDoc.customer_id);

    await orderDoc.ref.update({rated: true})
    await firestore.collection(`customers/${orderDoc.get("customer_id")}/orders`).doc(orderDoc.id).update({rated:true});
    await firestore.collection(`sellers/${orderDoc.get("seller_id")}/orders`).doc(orderDoc.id).update({rated:true});
    await firestore.collection(`agents/${orderDoc.get("agent_id")}/orders`).doc(orderDoc.id).update({rated:true});
});


// Função para responder uma avaliação 
exports.answerAvaliation = functions.https.onCall(async (data, context) => {
    console.log("answerAvaliation: ", data.rating);
    // const orderDoc = await firestore.collection("orders").doc(data.orderId).get();      
    for (let index = 0; index < data.rating.length; index++) {
        const element = data.rating[index];
        console.log("element: ", element);
        console.log("ads_id: ", element['ads_id']);
        if(element['ads_id'] == null){
            const sellerRatingQuery = await firestore.collection(`sellers/${data.sellerId}/ratings`).where("order_id", "==", data.orderId).get();
            const sellerRatingDoc = sellerRatingQuery.docs[0];
            await sellerRatingDoc.ref.update({
                answered: true,
                answer: element['answer'],
            });
            await firestore.collection("ratings").doc(sellerRatingDoc.id).update({
                answered: true,
                answer: element['answer'],
            });
        } else {
            const adsRatingQuery = await firestore.collection(`ads/${element['ads_id']}/ratings`).where("order_id", "==", data.orderId).get();
            const adsRatingDoc = adsRatingQuery.docs[0];
            await adsRatingDoc.ref.update({
                answered: true,
                answer: element['answer'],
            });
            await firestore.collection("ratings").doc(adsRatingDoc.id).update({
                answered: true,
                answer: element['answer'],
            });
        }        
    }
});

// Função para curtir uma publicação
exports.likeAds = functions.https.onCall(async (data, context) => {
    // data = [like, adsId, userId]
    let ads = await firestore.collection("ads").doc(data.adsId).get();
    console.log(`ads id: ${ads.id}`);
    console.log(`ads seller_id: ${ads.seller_id}`);
    let adsSel = firestore.collection("sellers").doc(ads.get("seller_id")).collection("ads").doc(data.adsId);
    let user = firestore.collection("customers").doc(data.userId);

    if (data.like) {
        let likeRef = ads.ref.collection("likes").doc(user.id);

        await likeRef.set({
            id: user.id,
            liked_at: firebase.firestore.FieldValue.serverTimestamp(),
        }).then(async function (result) {
            await ads.ref.update({
                like_count: firebase.firestore.FieldValue.increment(1)
            });
        });

        let likeSelRef = adsSel.collection("likes").doc(user.id);

        await likeSelRef.set({
            id: user.id,
            liked_at: firebase.firestore.FieldValue.serverTimestamp(),
        }).then(async function (result) {
            await adsSel.update({
                like_count: firebase.firestore.FieldValue.increment(1)
            });
        });

        let favoriteRef = user.collection("favorites").doc(ads.id);

        await favoriteRef.set({
            id: ads.id,
            favorited_at: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        await ads.ref.collection("likes").doc(user.id).delete();
        await ads.ref.update({
            like_count: firebase.firestore.FieldValue.increment(-1)
        });
        await adsSel.collection("likes").doc(user.id).delete();
        await adsSel.update({
            like_count: firebase.firestore.FieldValue.increment(-1)
        });
        await user.collection("favorites").doc(ads.id).delete();
    }
});

// Função para realizar uma pergunta ao vendedor
exports.toAsk = functions.https.onCall(async (data, context) => {
    // Data = [question, userId, adsId]
    let adsDoc = await firestore.collection("ads").doc(data.adsId).get();
    let sellerDoc = firestore.collection("sellers").doc(adsDoc.get("seller_id"));
    let adsSel = sellerDoc.collection("ads").doc(data.adsId);
    let user = await firestore.collection("customers").doc(data.userId).get();

    console.log(`question: ${data.question}, userId: ${data.userId}, adsId: ${data.adsId}`);

    let questionObj = {
        ads_id: data.adsId,
        answer: null,
        answered: false,
        answered_at: null,
        author: data.userId,
        author_name: user.get("username"),
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        question: data.question,
        id: null,
        status: "VISIBLE",
    };

    let questionRef = await adsDoc.ref.collection("questions").add(questionObj);
    await questionRef.update({
        id: questionRef.id
    });

    let questionData = (await questionRef.get()).data();

    let questionDocRef = adsSel.collection("questions").doc(questionRef.id);
    await questionDocRef.set(questionData);

    let questionSubSel = sellerDoc.collection("questions").doc(questionDocRef.id);
    await questionSubSel.set(questionData);

    await sellerDoc.update({
        new_questions: firebase.firestore.FieldValue.increment(1)
    });
});

// Função para responder uma pergunta
exports.toAnswer = functions.https.onCall(async (data, context) => {
    // Data = [questionId, answer, sellerId]
    let sellerDoc = firestore.collection("sellers").doc(data.sellerId);
    let questionDoc = await sellerDoc.collection("questions").doc(data.questionId).get();
    let adsRef = firestore.collection("ads").doc(questionDoc.get("ads_id"));
    let queAdsDoc = adsRef.collection("questions").doc(data.questionId);
    let adsSelRef = sellerDoc.collection("ads").doc(questionDoc.get("ads_id"));
    let queAdsSel = adsSelRef.collection("questions").doc(data.questionId);

    let updObj = {
        answer: data.answer,
        answered: true,
        answered_at: firebase.firestore.FieldValue.serverTimestamp(),
    };

    await questionDoc.ref.update(updObj);

    await queAdsDoc.update(updObj);

    await queAdsSel.update(updObj);
});

// Função para criar um novo endereço
exports.newAddress = functions.https.onCall(async (data, context) => {
    // data = {address, collection, userId}

    let now = firebase.firestore.FieldValue.serverTimestamp();
    let user = firestore.collection(data.collection).doc(data.userId);
    let addresses = firestore.collection(`${data.collection}/${data.userId}/addresses`);

    if (data.address.main) {

        for (let address of (await addresses.get()).docs) {
            if (address.get("main")) {
                await address.ref.update({
                    main: false
                });
            }
        }

        // (await addresses.get()).docs.forEach(async function (address) {
        //     if (address.get("main")) {
        //         await address.ref.update({ main: false });
        //     }
        // });
    }

    await addresses.add(data.address).then(async function (result) {
        await result.update({
            id: result.id,
            created_at: now,
            status: "ACTIVE",
            main: false,
        });
        console.log("main_address: " + (await user.get()).get("main_address"));
        if (data.address.main || !(await user.get()).get("main_address")) {
            await user.update({
                main_address: result.id
            });

            await result.update({
                main: true,
            });
        }
    });
});

// Função para editar um endereço
exports.editAddress = functions.https.onCall(async (data, context) => {
    // data = {address, collection, userId}

    let user = firestore.collection(data.collection).doc(data.userId);
    let addresses = await firestore.collection(`${data.collection}/${data.userId}/addresses`).get();
    const address = await firestore.collection(`${data.collection}/${data.userId}/addresses`).doc(data.address.id).get();

    if (address.get("main") != data.address.main) {
        if (data.address.main) {
            await user.update({
                main_address: data.address.id
            });
            for (let address of addresses.docs) {
                if (address.get("main")) {
                    await address.ref.update({
                        main: false
                    });
                }
            }

        } else {
            await user.update({
                main_address: null
            });
        }
    }

    await firestore.collection(`${data.collection}/${data.userId}/addresses`).doc(data.address.id).update(data.address);

    if (data.address.main) {
        await user.update({
            main_address: data.address.id
        });
    }

    //     (await addresses.get()).docs.forEach(async function (address) {
    //         if (address.get("main")) {
    //             await address.ref.update({ main: false });
    //         }
    //     });

    // let address = addresses.doc(data.address.id);
    // await address.update(data.address).then(async function (result) {
    //     if (!(await user.get()).get("main_address")) {
    //         await address.update({ main: true });
    //     }
    // });

    // if (data.address.main || !(await user.get()).get("main_address")) { await user.update({ main_address: address.id }); }
});
// Função que altera o cartão principal do usuário no stripe.
exports.changingCardToMain = functions.https.onCall(async (data, context) => {

});

// Método que remove o cartão do usuário no stripe
exports.removeCardInStripe = functions.https.onCall(async (data, context) => {
    try {
        console.log("xxxxxxxxxxx removeCardInStripe: ", data.userUid, data.cardUid);
        const userDoc = await firebase.firestore().collection(data.userCollection).doc(data.userUid).get();
        const customerId = userDoc.get("customer_id");

        console.log("xxxxxxxxxxx customerId: ", customerId);

        const cardDoc = await userDoc.ref.collection("cards").doc(data.cardUid).get();
        const customerCardId = cardDoc.get("card_id");

        console.log("xxxxxxxxxxx cardCustomerId: ", customerCardId);

        const deleted = await stripe.customers.deleteSource(
            customerId,
            customerCardId,
        );

        const paymentMethod = await firebase.firestore().collection(`stripe_customers/${data.userUid}/payment_method`).where("id", "==", customerCardId).get();

        if (paymentMethod.docs.length != 0) {
            const paymentMethodDoc = paymentMethod.docs[0];
            await paymentMethodDoc.ref.update({
                "status": "REMOVED"
            });
        }

        console.log("xxxxxxxxxxx removeCard: ", cardDoc.get("main"));


        if (cardDoc.get("main")) {
            const cardsQuery = await firebase.firestore()
                .collection(data.userCollection)
                .doc(data.userUid)
                .collection("cards")
                .where("status", "==", "ACTIVE")
                .get();

            for (var i = 0; i < cardsQuery.docs.length; i++) {
                const cardRef = cardsQuery.docs[i];

                console.log("xxxxxxxxxxx for: ", cardRef.get("id"));


                if (cardRef.get("id") != data.cardUid) {
                    await cardRef.ref.update({
                        main: true
                    });

                    const customer = await stripe.customers.update(
                        customerId, {
                            invoice_settings: {
                                default_payment_method: cardRef.get("card_id")
                            }
                        }
                    );
                    break;
                }
            }
        }

        await cardDoc.ref.update({
            status: "REMOVED",
            main: false
        });

        return "success";
    } catch (error) {
        console.log("error");
        console.log(error);
        console.log(error.code);

        return "failed";
    }
});

// Método que cria o cartão do usuário no stripe
exports.createCardInStripe = functions.https.onCall(async (data, context) => {
    const userDoc = await firebase.firestore().collection(data.userCollection).doc(data.userUid).get();
    const customerId = userDoc.get("customer_id");
    var param = {};

    console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxx card: ", data.card);
    console.log("xxxxxxxxxxxxx createCard function", data.userCollection, data.userUid);

    param.card = {
        number: data.card.card_number,
        exp_month: data.card.due_date.substring(0, 2),
        exp_year: "20" + data.card.due_date.substring(2, 4),
        cvc: data.card.security_code,
        address_city: data.card.billing_city,
        address_country: "Brasil",
        address_line1: data.card.billing_address,
        address_state: data.card.billing_state,
        name: data.card.name_card_holder,
    };

    var dbCard = {
        billing_address: data.card.billing_address,
        billing_cep: data.card.billing_cep,
        billing_state: data.card.billing_state,
        billing_city: data.card.billing_city,
        colors: data.card.colors,
        due_date: data.card.due_date,
        name_card_holder: data.card.name_card_holder,
        final_number: data.card.card_number.substring(12, 16),
        card_id: "",
        main: data.card.main,
        brand: null,
        // security_code: data.card.security_code,
    };

    try {
        console.log("xxxxxxxxxxx try");

        const token = await stripe.tokens.create(param);
        const tokenId = token.id;
        console.log("xxxxxxxxxxx tokenId: ", tokenId);
        console.log("xxxxxxxxxxx token: ", token);

        const source = await stripe.customers.createSource(customerId, {
            source: tokenId
        });
        console.log("zzzzzzzzz card: ", JSON.stringify(source));
        await firebase.firestore().collection(`stripe_customers/${data.userUid}/payment_method`).add(source);

        dbCard.brand = source.brand;

        var refCard = await firebase.firestore()
            .collection(data.userCollection)
            .doc(data.userUid)
            .collection('cards')
            .add(dbCard);

        console.log("xxxxxxxxxxxxx createCard function", refCard.id);

        await refCard.update({
            "card_id": source.id,
            "id": refCard.id,
            "created_at": firebase.firestore.FieldValue.serverTimestamp(),
        });

        const cardsQuery = await userDoc.ref
            .collection('cards')
            .where('status', '==', 'ACTIVE')
            .get();

        console.log("xxxxxxxxxxx cardsQuery: ", cardsQuery.docs.length, data.card.main);

        if (data.card.main == false) {
            if (cardsQuery.docs.isEmpty) {
                dbCard.main = true;
            } else {
                var singleMainCard = true;

                for (var i = 0; i < cardsQuery.docs.length; i++) {
                    const cardDoc = cardsQuery.docs[i];
                    console.log("xxxxxxx for ", cardDoc.get("main"));

                    if (cardDoc.get("main")) {
                        singleMainCard = false;
                        break;
                    }
                }
                console.log('%%%% dps do for', singleMainCard);
                dbCard.main = singleMainCard;
            }
        } else {
            cardsQuery.docs.forEach(async (cardDoc) => {
                console.log('%%%% forEach', cardDoc.get("main"));

                if (cardDoc.get("main")) {
                    await cardDoc.ref.update({
                        'main': false
                    });
                }
            });
        }

        await refCard.update({
            "main": dbCard.main,
            "status": "ACTIVE",
        });

        // definindo o cartão do stripe como o cartão padrão.
        if (data.card.main == true || dbCard.main) {
            console.log("xxxxxxxxx if card.main == true: ", source.id);
            const customer = await stripe.customers.update(
                customerId, {
                    invoice_settings: {
                        default_payment_method: source.id
                    }
                }
            );
        }

        console.log("newCard: ", dbCard);
        return 'success';
    } catch (error) {
        console.log("xxxxxxxxxxx catch error: ", error.code);
        console.log("xxxxxxxxxxx catch error: ", error);
        return error.code;
    }
});

exports.customerCreate = functions.https.onCall(async (data, context) => {
    try {
        console.log("customerCreate ", data);
        console.log("customerCreate ", data.userUid);

        const userDoc = await firebase.firestore().collection("customers").doc(data.userUid).get();

        const customer = await stripe.customers.create({
            email: userDoc.get("email")
        });

        await firebase.firestore().collection("stripe_customers").doc(userDoc.id).set({
            customer_id: customer.id,
        });

        await userDoc.ref.update({
            "customer_id": customer.id
        });

        return "userCreated";

    } catch (error) {
        console.log("error");
        console.log(error);
        console.log(error.code);

        return error.code;
    }
});

async function sendNotificationToSupport(text, senderId) {
    console.log("text: " + text);

    const infoQuery = await firestore.collection('info').get();
    const infoDoc = infoQuery.docs[0];
    const tokenId = infoDoc.get("token_id_support");
    const senderDoc = await firestore.collection('customers').doc(senderId).get();
    const senderAvatar = senderDoc.get("avatar");

    const notificationRef = await firestore.collection("notifications").add({
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        sended_at: null,
        id: null,
        text: text,
        sender_id: senderId,
        receiver_id: "SUPPORT",
        title: "Mercado Expresso",
        status: "PENDING",
        viewed: false,
        sender_avatar: senderAvatar,
    });

    await notificationRef.update({
        id: notificationRef.id,
    });

    const payload = {
        notification: {
            title: "Mercado Expresso",
            body: text,
            // score: '850',
            // time: '2:45',
        }
    }


    console.log("tokenId: " + tokenId, tokenId.length);
    if (tokenId && tokenId.length != 0) {
        await messaging.sendToDevice(tokenId, payload)
            .then(async function (res) {
                console.log("Mensagem enviada com sucesso " + res);
                await notificationRef.update({
                    status: "SENDED",
                    sended_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .catch(function (error) {
                notificationRef.delete();
                console.log("Erro ao enviar a mensagem: " + error);
            });
    }
};

async function sendNotification(senderId, receiverId, receiverCollection, text, senderCollection) {
    console.log("userId: " + senderId, receiverId);
    console.log("userCollection: " + receiverCollection, senderCollection);
    console.log("text: " + text);

    const senderDoc = await firestore.collection(senderCollection).doc(senderId).get();
    const receiverDoc = await firestore.collection(receiverCollection).doc(receiverId).get();
    const tokenId = receiverDoc.get("token_id");
    const senderAvatar = senderDoc.get("avatar");
    console.log("receiverDoc.get(notification_enabled): " + receiverDoc.get("notification_enabled"));

    const notificationRef = await firestore.collection("notifications").add({
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        sended_at: null,
        id: null,
        text: text,
        sender_id: senderId,
        receiver_id: receiverId,
        title: "Mercado Expresso",
        status: "PENDING",
        viewed: false,
        sender_avatar: senderAvatar,
    });

    await notificationRef.update({
        id: notificationRef.id,
    });

    const payload = {
        notification: {
            title: "Mercado Expresso",
            body: text,
            // score: '850',
            // time: '2:45',
        }
    }


    if (tokenId && tokenId.length != 0 && receiverDoc.get("notification_enabled") == true) {
        await messaging.sendToDevice(tokenId, payload)
            .then(async function (res) {
                console.log("tokenId: " + tokenId, tokenId.length);
                console.log("Mensagem enviada com sucesso " + res);
                await receiverDoc.ref.update({
                    new_notifications: firebase.firestore.FieldValue.increment(1)
                });
                await notificationRef.update({
                    status: "SENDED",
                    sended_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                const receiverNotificationRef = await receiverDoc.ref.collection("notifications").doc(notificationRef.id).set(
                    (await notificationRef.get()).data(),
                );
            })
            .catch(function (error) {
                notificationRef.delete();
                console.log("Erro ao enviar a mensagem: " + error);
            });
    }
};

// sempre que um usuário for criado no DB esse método é acionado
// exports.customerCreate = functions.firestore.document("customers/{customerId}").onCreate(async (snap, context) => {
//     try {
//         console.log("customerCreate ", snap);
//         console.log("customerCreate ", snap.data());
//         console.log("customerCreate ", snap.get("email"));

//         const customer = await stripe.customers.create({ email: snap.get("email") });

//         await firebase.firestore().collection("stripe_customers").doc(snap.id).set({
//             customer_id: customer.id,
//         });

//         await firebase.firestore().collection("customers").doc(snap.id).update({ "customer_id": customer.id });

//     } catch (error) {
//         console.log("error");
//         console.log(error);
//         console.log(error.code);
//     }
// });

/* <<<<<<<<<<<<<<<<<<<<<< function's model >>>>>>>>>>>>>>>>>>>>> */

// on call function model
// exports.functionName = functions.https.onCall(async (data, context) => {
// });

// on create functino model - observa sempre que um documento é criado no banco
// exports.functionName = functions.firestore.document('customers/{customerId}').onCreate(async (snap, context) => {
// });

// função para ser chamada localmente.
// async function functionName(){
// }