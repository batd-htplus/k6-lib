#!/bin/bash

K6_PATH="$(which k6)"
SCRIPT_PATH="$1"
TEST_TYPE="$2"
VUS="$3"
DURATION="$4"

if [ -f .env ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ $line =~ ^[^#]*= && ! $line =~ ^[[:space:]]*# ]]; then
            export "$line"
        fi
    done < .env
fi

if [ -z "$SCRIPT_PATH" ]; then
    echo "Usage: $0 <script_or_directory> [type] [vus] [duration]"
    echo ""
    echo "Test Types (optional - defaults to using scenarios from test file):"
    echo "  performance  - Override with Performance Test (50 VUs, 5m)"
    echo "  load         - Override with Load Test (80 VUs, 10m)"
    echo "  custom       - Override with custom VUs and duration"
    echo ""
    echo "Examples:"
    echo "  # Run single test file (uses scenarios from test file)"
    echo "  $0 dist/scenarios/project_example/smoke/post.test.js"
    echo "  $0 dist/scenarios/project_example/load/post.test.js"
    echo ""
    echo "  # Run all tests in a directory"
    echo "  $0 dist/scenarios/project_example/load"
    echo "  $0 dist/scenarios/project_example"
    echo ""
    echo "  # Override with custom VUs and duration"
    echo "  $0 dist/scenarios/project_example/performance/post.test.js custom 100 15m"
    echo ""
    echo "  # Override with preset (overrides test file scenarios)"
    echo "  $0 dist/scenarios/project_example/performance/post.test.js performance"
    exit 1
fi

if ! command -v k6 &> /dev/null; then
    echo "Error: k6 not found"
    echo "Please install k6 first using:"
    echo "  - Ubuntu/Debian: sudo apt install k6"
    echo "  - macOS (Homebrew): brew install k6"
    echo "  - CentOS/RHEL: sudo yum install k6"
    exit 1
fi

mkdir -p results

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ -d "$SCRIPT_PATH" ]; then
    echo "📁 Running all tests in directory: $SCRIPT_PATH"
    echo ""
    
    TEST_FILES=$(find "$SCRIPT_PATH" -name "*.test.js" -type f | sort)
    
    if [ -z "$TEST_FILES" ]; then
        echo "❌ No test files found in $SCRIPT_PATH"
        exit 1
    fi
    
    TEST_COUNT=$(echo "$TEST_FILES" | wc -l)
    echo "Found $TEST_COUNT test file(s):"
    
    BASE_PATH=""
    if [[ "$SCRIPT_PATH" == dist/scenarios/* ]]; then
        BASE_PATH="dist/scenarios/"
    elif [[ "$SCRIPT_PATH" == src/scenarios/* ]]; then
        BASE_PATH="src/scenarios/"
    fi
    
    echo "$TEST_FILES" | while read -r file; do
        if [ -n "$BASE_PATH" ]; then
            REL_PATH="${file#$BASE_PATH}"
        else
            REL_PATH="${file#$SCRIPT_PATH/}"
        fi
        echo "  - $REL_PATH"
    done
    echo ""
    
    FAILED=0
    TOTAL=0
    for TEST_FILE in $TEST_FILES; do
        TOTAL=$((TOTAL + 1))
        TEST_NAME=$(basename "$TEST_FILE" .test.js)
        
        if [ -n "$BASE_PATH" ]; then
            REL_PATH="${TEST_FILE#$BASE_PATH}"
        else
            REL_PATH="${TEST_FILE#$SCRIPT_PATH/}"
        fi
        
        REL_DIR=$(dirname "$REL_PATH")
        TEST_FILE_NAME=$(basename "$REL_PATH" .test.js)
        
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🧪 [$TOTAL/$TEST_COUNT] Running: $REL_PATH"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        
        REPORT_DIR="results/${REL_DIR}/${TEST_FILE_NAME}_${TIMESTAMP}"
        mkdir -p "$REPORT_DIR"
        
        K6_ARGS=""
        if [ -n "$TEST_TYPE" ]; then
            case "$TEST_TYPE" in
                "performance")
                    VUS=${VUS:-50}
                    DURATION=${DURATION:-5m}
                    K6_ARGS="--vus $VUS --duration $DURATION"
                    ;;
                "load")
                    VUS=${VUS:-80}
                    DURATION=${DURATION:-10m}
                    K6_ARGS="--vus $VUS --duration $DURATION"
                    ;;
                "custom")
                    if [ -z "$VUS" ] || [ -z "$DURATION" ]; then
                        echo "Error: Custom test requires VUS and DURATION parameters"
                        exit 1
                    fi
                    K6_ARGS="--vus $VUS --duration $DURATION"
                    ;;
            esac
        fi
        
        K6_WEB_DASHBOARD=true \
        K6_WEB_DASHBOARD_EXPORT="$REPORT_DIR/dashboard-report.html" \
        K6_WEB_DASHBOARD_HOST="127.0.0.1" \
        K6_WEB_DASHBOARD_PORT="5665" \
        k6 run "$TEST_FILE" \
            --out json="$REPORT_DIR/result.json" \
            --out csv="$REPORT_DIR/result.csv" \
            --summary-export="$REPORT_DIR/summary.json" \
            --summary-trend-stats="avg,p(95)" \
            -e K6_SUMMARY_DIR="$REPORT_DIR" \
            $K6_ARGS
        
        if [ $? -eq 0 ]; then
            echo "✅ $TEST_NAME passed"
        else
            echo "❌ $TEST_NAME failed"
            FAILED=$((FAILED + 1))
        fi
        echo ""
    done
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Summary: $TOTAL tests, $FAILED failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ $FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
fi

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "Error: File not found: $SCRIPT_PATH"
    exit 1
fi

TEST_NAME=$(basename "$SCRIPT_PATH" .test.js)

REL_PATH="$SCRIPT_PATH"
if [[ "$SCRIPT_PATH" == dist/scenarios/* ]]; then
    REL_PATH="${SCRIPT_PATH#dist/scenarios/}"
elif [[ "$SCRIPT_PATH" == src/scenarios/* ]]; then
    REL_PATH="${SCRIPT_PATH#src/scenarios/}"
fi

REL_DIR=$(dirname "$REL_PATH")
TEST_FILE_NAME=$(basename "$SCRIPT_PATH" .test.js)

REPORT_DIR="results/${REL_DIR}/${TEST_FILE_NAME}_${TIMESTAMP}"
mkdir -p "$REPORT_DIR"

case "$TEST_TYPE" in
    "performance")
        VUS=${VUS:-50}
        DURATION=${DURATION:-5m}
        echo "🚀 Running k6 Performance Test..."
        echo "⚡ Configuration: $VUS VUs for $DURATION (overriding test file scenarios)"
        K6_ARGS="--vus $VUS --duration $DURATION"
        ;;
    "load")
        VUS=${VUS:-80}
        DURATION=${DURATION:-10m}
        echo "🚀 Running k6 Load Test..."
        echo "🔥 Configuration: $VUS VUs for $DURATION (overriding test file scenarios)"
        K6_ARGS="--vus $VUS --duration $DURATION"
        ;;
    "custom")
        if [ -z "$VUS" ] || [ -z "$DURATION" ]; then
            echo "Error: Custom test requires VUS and DURATION parameters"
            echo "Example: $0 $SCRIPT_PATH custom 100 15m"
            exit 1
        fi
        echo "🚀 Running k6 Custom Test..."
        echo "⚙️ Configuration: $VUS VUs for $DURATION (overriding test file scenarios)"
        K6_ARGS="--vus $VUS --duration $DURATION"
        ;;
    *)
        if [[ "$TEST_TYPE" == --* ]]; then
            echo "🚀 Running k6 tests with custom parameters..."
            echo "📊 Dashboard URL: http://127.0.0.1:5665"
            echo "📁 Results will be saved to: $REPORT_DIR"
            echo ""
            K6_WEB_DASHBOARD=true \
            K6_WEB_DASHBOARD_EXPORT="$REPORT_DIR/dashboard-report.html" \
            K6_WEB_DASHBOARD_HOST="127.0.0.1" \
            K6_WEB_DASHBOARD_PORT="5665" \
            k6 run "$SCRIPT_PATH" \
                --out json="$REPORT_DIR/result.json" \
                --out csv="$REPORT_DIR/result.csv" \
                --summary-export="$REPORT_DIR/summary.json" \
                --summary-trend-stats="avg,p(95)" \
                -e K6_SUMMARY_DIR="$REPORT_DIR" \
                "$TEST_TYPE" "$VUS" "$DURATION"
            exit $?
        else
            echo "🚀 Running k6 test..."
            echo "🎯 Using scenarios defined in test file"
            K6_ARGS=""
        fi
        ;;
esac

echo "📊 Dashboard URL: http://127.0.0.1:5665"
echo "📁 Results will be saved to: $REPORT_DIR"
echo ""

K6_WEB_DASHBOARD=true \
K6_WEB_DASHBOARD_EXPORT="$REPORT_DIR/dashboard-report.html" \
K6_WEB_DASHBOARD_HOST="127.0.0.1" \
K6_WEB_DASHBOARD_PORT="5665" \
k6 run "$SCRIPT_PATH" \
    --out json="$REPORT_DIR/result.json" \
    --out csv="$REPORT_DIR/result.csv" \
    --summary-export="$REPORT_DIR/summary.json" \
    --summary-trend-stats="avg,p(95)" \
    -e K6_SUMMARY_DIR="$REPORT_DIR" \
    $K6_ARGS

if [ $? -eq 0 ]; then
    echo "✅ Test completed successfully!"
    echo "📁 Results saved in: $REPORT_DIR"
    echo ""
    echo "📊 View your results:"
    echo "  - 🌐 Built-in Dashboard: $REPORT_DIR/dashboard-report.html (with custom metrics)"
    echo "  - 📊 JSON Data: $REPORT_DIR/result.json"
    echo "  - 📈 CSV Data: $REPORT_DIR/result.csv"
    echo "  - 📋 Summary: $REPORT_DIR/summary.json"
    echo ""
    echo "🌐 Open in browser:"
    echo "  file://$(pwd)/$REPORT_DIR/dashboard-report.html"
else
    echo "❌ Test failed! Check the console output for details."
    exit 1
fi
