import { View } from "react-native";
import { WebView } from "react-native-webview";

type Props = {
    /** The HTML to show, such as an email's body. */
    html: string;
    height: number;
    title: string;
};

/**
 * HTML drawn as an email app would draw it: on white, with scripts off and links going nowhere,
 * so a preview can never run anything or leave the app.
 */
const HtmlPreview = ({ html, height, title }: Props) => (
    <View style={{ height, backgroundColor: "#fff" }} accessibilityLabel={title}>
        <WebView
            originWhitelist={["about:*"]}
            source={{
                html: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body style="margin:16px;background:#fff">${html}</body></html>`,
            }}
            javaScriptEnabled={false}
            onShouldStartLoadWithRequest={(request) => request.url.startsWith("about:")}
            style={{ backgroundColor: "#fff" }}
        />
    </View>
);

export default HtmlPreview;
