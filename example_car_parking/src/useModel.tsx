import { useState, useEffect, useCallback } from "react";
import KeyWordRNBridge from "../rnkeywordspotter/KeyWordRNBridge";
import { KeyWordRNBridgeInstance, createKeyWordRNBridgeInstance } from '../rnkeywordspotter/KeyWordRNBridgeClass';

type DetectionCallback = (event: any) => void;
let keyWordRNBridgeInstances:KeyWordRNBridgeInstance[] = [];

/**
 * Custom hook for handling keyword detection using KeyWordRNBridge
 * @returns An object with functions and state for keyword detection
 */
export const useModel = () => {
    // State to track whether the keyword detection is currently active
    const [isListening, setIsListening] = useState(false);
    let currentEventListener: any[] = [];
    /**
     * Set the keyword detection license
     * @param licenseKey - The license key
     */
    // const setLicense = useCallback(async (licenseKey: any) => {
    //     try {
    //         await KeyWordRNBridge.setKeywordDetectionLicense(licenseKey);
    //     } catch (error) {
    //         console.error("[useModel] Error setting license:", error);
    //     }
    // }, []);

    /**
     * Load the keyword detection model
     * @param modelFileName - The name of the model file to load
     * @param threshold - The detection threshold
     * @param bufferCount - The number of audio buffers
     */
    const loadModel = useCallback(async (state) => {
        console.log("loadModel()")
        const modelFileNameOptions = {
            'default': ["need_help_now.onnx"],
            'state1': ["hey_pango.onnx"],
            'state2': ["i_want_to_park.onnx","i_want_to_stop_park_model.onnx", "need_help_now.onnx"],
        };
        console.log("loadModel() - model:", modelFileNameOptions[state][0])
        try {
            const modelFileName = modelFileNameOptions[state][0];
            const threshold = 0.9999;
            const bufferCount = 2;
            console.log("Caling replaceKeywordDetectionModel()");
            const result = await KeyWordRNBridge.replaceKeywordDetectionModel(
                modelFileName,
                threshold,
                bufferCount,
            );
            console.log("Model loaded:", result);
            const isLicensed = await KeyWordRNBridge.setKeywordDetectionLicense(
                "MTczMjkxNzYwMDAwMA==-DDwBWs914KpHbWBBSqi28vhiM4l5CYG+YgS2n9Z3DMI=",
            );
            console.log("isLicensed:",isLicensed);
            if (!isLicensed)
                console.error("license invalid - please contact ofer@davoice.io");

            if (state === 'state2') {
                keyWordRNBridgeInstances[0] = createKeyWordRNBridgeInstance('instance0');
                keyWordRNBridgeInstances[1] = createKeyWordRNBridgeInstance('instance1');
                for (let i=0; i<2; i++) {
                    const result = await keyWordRNBridgeInstances[i].replaceKeywordDetectionModel(
                        modelFileNameOptions[state][i+1],
                        threshold,
                        bufferCount,
                    );
                    console.log("Model loaded:", result);
                    const isLicensed = await keyWordRNBridgeInstances[i].setKeywordDetectionLicense(
                        "MTczMjkxNzYwMDAwMA==-DDwBWs914KpHbWBBSqi28vhiM4l5CYG+YgS2n9Z3DMI=",
                    );
                    console.log("isLicensed:",isLicensed);
                    if (!isLicensed)
                        console.error("license invalid - please contact ofer@davoice.io");
                }
            }
        } catch (error) {
            console.error("[useModel] Error loading model:", error);
        }
    }, []);

    /**
     * Start listening for the keyword
     * @param callback - Function to be called when the keyword is detected
     */
    const startListening = useCallback(async (callback: DetectionCallback) => {
        try {
            // Set up the event listener for keyword detection
            const eventListener = KeyWordRNBridge.onKeywordDetectionEvent(
                (event: any) => {
                    eventListener.remove();
                    currentEventListener[0] = null;
                    console.log("KeyWordRNBridge.onKeywordDetectionEvent()");
                    callback(event);
                },
            );
            currentEventListener[0] = eventListener;
            console.log("startListening(): with Model - ", await KeyWordRNBridge.getKeywordDetectionModel());
            console.log("[useModel] eventListener", eventListener);
            // Start the phrase spotting
            KeyWordRNBridge.startKeywordDetection();
            // Update the listening state
            setIsListening(true);
        } catch (error) {
            console.error("Error starting keyword detection:", error);
        }
    }, []);

        /**
     * Start listening for the keyword
     * @param callback - Function to be called when the keyword is detected
     */
        const startListeningMulti = useCallback(async (callback: DetectionCallback) => {
            try {
                // Set up the event listener for keyword detection
                const eventListener = KeyWordRNBridge.onKeywordDetectionEvent(
                    (event: any) => {
                        eventListener.remove();
                        currentEventListener[0] = null;
                        console.log("KeyWordRNBridge.onKeywordDetectionEvent()");
                        callback(event);
                    },
                );
                currentEventListener[0] = eventListener;
                console.log("startListening(): with Model - ", await KeyWordRNBridge.getKeywordDetectionModel());
                console.log("[useModel] eventListener", eventListener);
                // Start the phrase spotting
                KeyWordRNBridge.startKeywordDetection();

                for (let i=0; i<2; i++) {
                    const eventListener = keyWordRNBridgeInstances[i].onKeywordDetectionEvent(
                        (event: any) => {
                            eventListener.remove();
                            currentEventListener[i+1] = null;
                            console.log("KeyWordRNBridge.onKeywordDetectionEvent()");
                            callback(event);
                        },
                    );
                    currentEventListener[i+1] = eventListener;
                    console.log("startListening(): with Model - ", await keyWordRNBridgeInstances[i].getKeywordDetectionModel());
                    console.log("[useModel] eventListener", eventListener);
                    // Start the phrase spotting
                    keyWordRNBridgeInstances[i].startKeywordDetection();
                }
                    // Update the listening state
                setIsListening(true);
            } catch (error) {
                console.error("Error starting keyword detection:", error);
            }
        }, []);    
    
    /**
     * Stop listening for the keyword
     */
    const stopListening = useCallback(async () => {
        try {
            // Stop the phrase spotting
            KeyWordRNBridge.stopKeywordDetection();
            if (currentEventListener[0]) {
                currentEventListener[0].remove();
                currentEventListener[0] = null;
            }

            // Update the listening state
            setIsListening(false);
        } catch (error) {
            console.error("Error stopping keyword detection:", error);
        }
    }, []);

    /**
     * Cleanup effect to stop listening when the component unmounts
     * or when the isListening state changes
     */
    useEffect(() => {
        console.log("isListening updated:", isListening);
        return () => {
            if (isListening) {
                stopListening();
            }
        };
    }, [isListening, stopListening]);

    // Return an object with the necessary functions and state
    return {
        isListening,
        // setLicense,
        loadModel,
        startListening,
        startListeningMulti,
        stopListening,
    };
};

