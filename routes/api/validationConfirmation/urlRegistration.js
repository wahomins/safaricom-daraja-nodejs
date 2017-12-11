var express = require('express')
var c2bRegistrationRouter = express.Router()

var auth = require('../../auth/auth')
var mpesaFunctions = require('../../helpers/mpesaFunctions')
const GENERIC_SERVER_ERROR_CODE = '01'

// Then load properties from a designated file.
var properties = require('nconf')
properties.file({file: 'config/properties.json'})

var CallbackURLModel = require('./c2bCallbackUrlModel')
var C2B_URL_REGISTRATION_SERVICE_NAME = 'C2B-URL-REGISTRATION'

/**
 * Save merchant call backs to database
 * @param req
 * @param res
 * @param next
 */
function registerMerchantCallBackUrl(req, res, next) {
    if (!req.body) {
        mpesaFunctions.handleError(res, 'Invalid request received', '01')
    }
    // Check initial registration
    var query = CallbackURLModel.findOne({
        shortCode: req.body.shortCode
    })

    // Execute query
    query.exec(function (err, callbackURLs) {
        // handle error
        if (err) {
            mpesaFunctions.handleError(res, 'Error fetching url registration object ' + err.message, GENERIC_SERVER_ERROR_CODE)
        }
        //  New record
        var newRecord = {
            shortCode: req.body.shortCode,
            merchant: {
                confirmation: req.body.confirmationURL,
                validation: req.body.validationURL
            }
        }

        if (callbackURLs) {
            console.log('Updating C2B Urls to local database')
            //    Update record
            var conditions = {
                'shortCode': req.body.shortCode
            }
            var options = {multi: true}
            CallbackURLModel.update(conditions, newRecord, options,
                function (err) {
                    if (err) {
                        mpesaFunctions.handleError(res, 'Unable to update transaction ' + err.message, GENERIC_SERVER_ERROR_CODE)
                    } else {
                        next()
                    }
                })
        } else {
            console.log('Saving C2B Urls to local database')
            var callbackUrl = new CallbackURLModel(
                newRecord
            )
            //  Save new record
            callbackUrl.save(function (err) {
                if (err) {
                    mpesaFunctions.handleError(res, err.message, GENERIC_SERVER_ERROR_CODE)
                } else {
                    next()
                }
            })
        }

    })
}

/**
 * Save API request to
 * @param req
 * @param res
 * @param next
 */
function registerAPICallBackUrl(req, res, next) {
    //    Prepare request object
    var URLsRegistrationObject = {
        ValidationURL: properties.get('validationConfirm:validationURL'),
        ConfirmationURL: properties.get('validationConfirm:confirmationURL'),
        ResponseType: properties.get('validationConfirm:responseType'),
        ShortCode: properties.get('validationConfirm:shortCode')
    }

    // Set url, AUTH token and transaction
    mpesaFunctions.sendMpesaTxnToSafaricomAPI({
        url: properties.get('validationConfirm:registerURLs'),
        auth: 'Bearer ' + req.transactionToken,
        transaction: URLsRegistrationObject
    }, req, res, next)

}

function setServiceName(req, res, next) {
    req.body.service = C2B_URL_REGISTRATION_SERVICE_NAME
    next();
}

c2bRegistrationRouter.put('/register/safaricom',
    setServiceName,
    auth,
    registerAPICallBackUrl,
    function (req, res, next) {
        res.json({
            status: '00',
            message: req.transactionResp.ResponseDescription || 'URL registered successful'
        });
    });

c2bRegistrationRouter.post('/register/merchant',
    setServiceName,
    registerMerchantCallBackUrl,
    function (req, res, next) {
        res.json({
            status: '00',
            message: 'URL registration successful'
        });
    });

module.exports = c2bRegistrationRouter
