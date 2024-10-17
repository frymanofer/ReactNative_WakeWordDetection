import { useState, useEffect, useCallback } from "react";
import KeyWordRNBridge from "../rnkeywordspotter/KeyWordRNBridge";

type DetectionCallback = (event: any) => void;

/**
 * Custom hook for handling keyword detection using KeyWordRNBridge
 * @returns An object with functions and state for keyword detection
 */
export const useModel = () => {
    // State to track whether the keyword detection is currently active
    const [isListening, setIsListening] = useState(false);
    let currentEventListener: any = null;
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
    const loadModel = useCallback(async (stage) => {
        console.log("loadModel()")
        const modelFileNameOptions = {
            'default': "need_help_now.onnx",
            'state1': "hey_pango.onnx",
            'state2': "i_want_to_park.onnx",
        };
        console.log("loadModel() - model:", modelFileNameOptions[stage])
        try {

            const modelFileName = modelFileNameOptions[stage];
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
                    currentEventListener = null;
                    console.log("KeyWordRNBridge.onKeywordDetectionEvent()");
                    callback(event);
                },
            );
            currentEventListener = eventListener;
            console.log("startListening(): with Model - ", await KeyWordRNBridge.gerKeywordDetectionModel());
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
     * Stop listening for the keyword
     */
    const stopListening = useCallback(async () => {
        try {
            // Stop the phrase spotting
            KeyWordRNBridge.stopKeywordDetection();
            if (currentEventListener) {
                currentEventListener.remove();
                currentEventListener = null;
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
        stopListening,
    };
};

