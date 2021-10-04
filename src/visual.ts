"use strict";
import {
    select as d3Select
} from "d3-selection";

import {
    scaleLinear,
    scaleBand
} from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import { BarChartSettings } from "./settings";
type Selection<T1, T2 = T1> = d3.Selection<any, T1, any, T2>;
import { dataViewObjects, dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import * as d3 from "d3";

const getEvent = () => require("d3-selection").event;
interface data {
    value: powerbi.PrimitiveValue;
    category: powerbi.PrimitiveValue;
    selectionId: ISelectionId;
    color: string;
    id: string,
    indexChart: number;
    sizeCircle: number;
    coordinateX?: number;
    coordinateY?: number;
    isClicked?: boolean;
    indexDot: number
}

interface BarChartDataPoint {
    data: data[]
    color: string;
    selectionId: ISelectionId;
    categoryDisplayName: string,
    measureDisplayName: string
}


interface BarChartViewModel {
    dataPoints: BarChartDataPoint[];
    dataMax: number;
    settings: BarChartSettings;
}

let defaultSettings: BarChartSettings = {
    enableAxisX: {
        show: true,
        fontSize: 16
    },
    enableAxisY: {
        show: true,
        label: true,
        fontSize: 16,
        fontSizeLabel: 14,
        labelText: "Units"
    },
    generalView: {
        opacity: 100,
        dataOnBar: true,
        sizeDots: 7
    },
    title: {
        hide: false,
        text: "Sales Forecast",
        fontSizeTitle: 22
    },
    tooltip: {
        fontSizeLabel: 12,
        fontSizeValue: 14,
        labelText: "Sales",
        enableGradient: true
    }
};


function visualTransform(options: VisualUpdateOptions, host: IVisualHost): BarChartViewModel {
    let dataViews = options.dataViews;
    let viewModel: BarChartViewModel = {
        dataPoints: [],
        dataMax: 0,
        settings: <BarChartSettings>{}
    };

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].categorical
        || !dataViews[0].categorical.categories
        || !dataViews[0].categorical.categories[0].source
        || !dataViews[0].categorical.values
    ) {
        return viewModel;
    }

    let categorical = dataViews[0].categorical;
    let category = categorical.categories[0];
    let dataValue = categorical.values;

    let barChartDataPoints: BarChartDataPoint[] = [];
    let dataMax: number;

    let objects = dataViews[0].metadata.objects;

    let barChartSettings: BarChartSettings = {
        enableAxisX: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "show",
            }, defaultSettings.enableAxisX.show),
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "enableAxisX", propertyName: "fontSize",
            }, defaultSettings.enableAxisX.fontSize),
        },
        enableAxisY: {
            show: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "show",
            }, defaultSettings.enableAxisY.show),
            label: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "label",
            }, defaultSettings.enableAxisY.label),
            fontSize: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "fontSize",
            }, defaultSettings.enableAxisY.fontSize),
            fontSizeLabel: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "fontSizeLabel",
            }, defaultSettings.enableAxisY.fontSizeLabel),
            labelText: dataViewObjects.getValue(objects, {
                objectName: "enableAxisY", propertyName: "labelText",
            }, defaultSettings.enableAxisY.labelText),
        },
        generalView: {
            opacity: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "opacity" }, defaultSettings.generalView.opacity),
            dataOnBar: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "dataOnBar" }, defaultSettings.generalView.dataOnBar),
            sizeDots: dataViewObjects.getValue(objects, { objectName: "generalView", propertyName: "sizeDots" }, defaultSettings.generalView.sizeDots),
        },
        title: {
            hide: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "hide" }, defaultSettings.title.hide),
            text: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "text" }, defaultSettings.title.text),
            fontSizeTitle: dataViewObjects.getValue(objects, { objectName: "title", propertyName: "fontSizeTitle" }, defaultSettings.title.fontSizeTitle),
        },
        tooltip: {
            fontSizeLabel: dataViewObjects.getValue(objects, { objectName: "tooltip", propertyName: "fontSizeLabel" }, defaultSettings.tooltip.fontSizeLabel),
            fontSizeValue: dataViewObjects.getValue(objects, { objectName: "tooltip", propertyName: "fontSizeValue" }, defaultSettings.tooltip.fontSizeValue),
            labelText: dataViewObjects.getValue(objects, { objectName: "tooltip", propertyName: "labelText" }, defaultSettings.tooltip.labelText),
            enableGradient: dataViewObjects.getValue(objects, { objectName: "tooltip", propertyName: "enableGradient" }, defaultSettings.tooltip.enableGradient),
        }
    };

    dataMax = Math.max(...dataValue.map(v => <number>v.max || <number>v.maxLocal))


    const defaultColor = {
        solid: {
            blue: "#5065B6",
        }
    };

    for (let i = 0, len = dataValue.length; i < len; i++) {
        //Фильтрую массив столбцов только меры. И перебирая все меры в них находится обьект с значениям цвета
        const color: string = dataViewObjects.getValue<powerbi.Fill>(dataViews[0].metadata.columns.filter(v => v.roles.measure === true)[i].objects, { objectName: "colorSelector", propertyName: "fill" }, { solid: { color: defaultColor.solid.blue } }).solid.color;

        const selectionId: ISelectionId = host.createSelectionIdBuilder()
            .withMeasure(dataValue[i].source.queryName)
            .createSelectionId();

        let data: { indexDot: number, sizeCircle: number, indexChart: number, id: string, color: string, value: powerbi.PrimitiveValue, category: powerbi.PrimitiveValue, selectionId: ISelectionId }[] = [];
        for (let y = 0; y < category.values.length; y++) {
            data.push({
                category: category.values[y],
                value: dataValue[i].values[y],
                selectionId: host.createSelectionIdBuilder()
                    .withCategory(category, y)
                    .withMeasure(dataValue[i].source.queryName)
                    .createSelectionId(),
                color: color,
                id: (category.values[y] + '_' + y).replace(/ /g, ''),
                indexChart: i,
                indexDot: y,
                sizeCircle: barChartSettings.generalView.sizeDots
            });
        }

        barChartDataPoints.push({
            color: color,
            selectionId,
            data: data,
            measureDisplayName: dataValue[i].source.displayName,
            categoryDisplayName: categorical.categories[0].source.displayName
        });
    }

    return {
        dataPoints: barChartDataPoints,
        dataMax: dataMax,
        settings: barChartSettings
    };
}

export class BarChart implements IVisual {
    private svg: Selection<any>;
    private barContainer: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private host: IVisualHost;
    private element: HTMLElement;
    private selectionManager: ISelectionManager;
    private barChartSettings: BarChartSettings;
    private barDataPoints: BarChartDataPoint[];
    private xAxis: Selection<SVGElement>;
    private yAxis: Selection<SVGElement>;
    private title: Selection<SVGElement>;
    private defs: Selection<SVGElement>;
    private barSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    private dataBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;

    private dots: d3.Selection<SVGCircleElement, data, SVGGElement, any>[] = []

    private gradientBarSelection: d3.Selection<d3.BaseType, any, d3.BaseType, any>;
    static Config = {
        solidOpacity: 1,
        transparentOpacity: 0.4,
        // xAxisFontMultiplier: 0.035,
        // yAxisFontMultiplier: 0.035,
        // titleFontMultiplier: 0.05,
        // dataOnBarFontMultiplier: 0.042,
    };



    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.element = options.element;
        this.selectionManager = options.host.createSelectionManager();

        this.svg = d3Select(options.element)
            .append('svg')
            .classed('barChart', true);


        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);

        this.yAxis = this.svg
            .append('g')
            .classed('yAxis', true);

        this.barContainer = this.svg
            .append('g')
            .classed('barContainer', true);


        this.defs = this.svg.append('defs')

    }

    public update(options: VisualUpdateOptions) {

        let viewModel: BarChartViewModel = visualTransform(options, this.host);

        let settings = this.barChartSettings = viewModel.settings;
        this.barDataPoints = viewModel.dataPoints;


        let width = options.viewport.width;
        let height = options.viewport.height;

        this.svg.attr("width", width).attr("height", height);

        let paddingTop = height * 0.12
        let paddingBottom = height * 0.12
        let paddingLeft = width * 0.035
        let paddingRight = paddingLeft

        let marginFirstBar = 0
        let marginAxisY = height * 0.035


        let fontSizeAxisX = settings.enableAxisX.fontSize // Math.min(height, width) * BarChart.Config.xAxisFontMultiplier;
        let fontSizeAxisY = settings.enableAxisY.fontSize //Math.min(height, width) * BarChart.Config.yAxisFontMultiplier;
        let fontSizeTitle = settings.title.fontSizeTitle //Math.min(height, width) * BarChart.Config.titleFontMultiplier;
        let fontSizeLabelY = settings.enableAxisY.fontSizeLabel //fontSizeAxisY / 1.2




        this.svg.selectAll('text.title').remove()
        if (!settings.title.hide) {
            this.title = this.svg
                .append('text')
                .text(settings.title.text)
                .classed('title', true)
                .attr("transform", `translate(${paddingLeft - 9}, ${paddingTop / 2})`)
                .style('font-size', fontSizeTitle)
        }

        //Убираем отступы и оси если пользователь отключил
        if (!settings.enableAxisX.show) {
            paddingBottom = 20
            this.xAxis.classed('remove', true)
        } else {
            this.xAxis.classed('remove', false)
        }

        if (!settings.enableAxisY.show) {
            this.yAxis.classed('remove', true)
            paddingLeft = 0
            paddingRight = 0
        } else {
            this.yAxis.classed('remove', false)
        }


        let heightYAxis = height - paddingTop - paddingBottom
        let widthXAxis = width - paddingLeft - paddingRight


        //Смещение графиков
        this.barContainer.attr('transform', `translate(${paddingLeft * 1.5}, ${paddingTop})`);
        //Смещение оси x
        this.xAxis.attr('transform', `translate(${paddingLeft}, ${heightYAxis + paddingTop})`);
        //Смещение оси y
        this.yAxis.attr('transform', `translate(${paddingLeft}, ${paddingTop})`)


        //функция интерполяции оси Y
        let yScale = scaleLinear()
            .domain([viewModel.dataMax, 0])
            .range([0, heightYAxis - marginAxisY]);
        //функция интерполяции оси X
        let xScale = scaleBand()
            .domain(viewModel.dataPoints[0].data.map(d => <string>d.category))
            .rangeRound([marginFirstBar, widthXAxis])
            .padding(0.7);

        //создаем оси
        let xAxis = axisBottom(xScale);
        let yAxis = axisLeft(yScale).ticks(4);  //ticks - задание количества делений, но движок d3 окончательно сам принимает решение
        this.xAxis.call(xAxis);
        this.yAxis.call(yAxis);

        this.xAxis.style('font-size', fontSizeAxisX)
        this.yAxis.style('font-size', fontSizeAxisY)

        this.removeHighlightAxisX()
        this.highlightAxisX()

        //Удаление названия оси перед его добавлением
        this.yAxis
            .selectAll('text.labelY')
            .remove()

        if (settings.enableAxisY.label) {
            //Добавление названия оси Y
            this.yAxis
                .select('g.tick')
                .append('text')
                .classed('labelY', true)
                .attr('x', -9)  // значения на оси x имеют атрибут x = -9
                .attr('y', -heightYAxis * 0.1)
                .attr('font-size', settings.enableAxisY.fontSizeLabel)
                .text(settings.enableAxisY.labelText)
        }

        // рисуем горизонтальные линии 
        this.yAxis.selectAll(".tick line")
            .classed("grid-line", true)
            .attr("x1", -10)    // для того чтобы линия начиналась от начала значения на оси Y
            .attr("y1", -fontSizeAxisY)    // для того чтобы линия стояла над значением на оси Y
            .attr("x2", widthXAxis) // ширина линии равняется ширине оси Xs
            .attr("y2", -10);   // для того чтобы линия стояла над значением на оси Y

        this.yAxis.selectAll('.tick text').classed('textYAxis', true)


        //----- Создание градиента

        this.gradientBarSelection = this.defs
            .selectAll('linearGradient')
            .data(this.barDataPoints);


        const gradientBarSelectionMerged = this.gradientBarSelection
            .enter()
            .append("linearGradient")
            .merge(<any>this.gradientBarSelection)

        gradientBarSelectionMerged
            .attr("id", (dataPoint: BarChartDataPoint, i: number) => `Gradient${i + 1}`)  //Индекс для того чтобы для каждого bar был свой элемент linearGradient нужно прописать айди уникальный
            .attr("x1", "0")    //Координаты заливки чтобы залить вертикально сверху вниз
            .attr("x2", "0")
            .attr("y1", "0")
            .attr("y2", "1")


        gradientBarSelectionMerged.selectAll('stop').remove()   //При обновлении удаляем элементы stop и дальше заменяем их обновленными

        gradientBarSelectionMerged
            .append("stop")
            .attr("offset", "0%")   //Начать с этого цвета 
            .attr("stop-color", (dataPoint: BarChartDataPoint) => dataPoint.color)


        if (settings.tooltip.enableGradient) {
            gradientBarSelectionMerged
                .append('stop')
                .attr("offset", "95%") //Закончить этим цветом
                .attr("stop-color", "white")
        }

        //-----------------  Создание градиента



        //-------- Создание диаграммы
        this.barContainer.selectAll(".axis").remove();
        viewModel.dataPoints.forEach((d, i) =>
            this.createChart(d, i, xScale, yScale, this.barContainer)
        );

        //------------------  Создание диаграммы

        // Перерисовка подсказки
        this.redrawRectTooltip(xScale, yScale, heightYAxis)
        this.redrawTooltip(viewModel, xScale, fontSizeAxisY, fontSizeLabelY, settings)

        this.dots.forEach((d, i) =>
            d.on('click', (d: data) => {
                if (this.host.hostCapabilities.allowInteractions) {
                    this.removeRectTooltip()
                    this.removetooltip()
                    this.removeHighlightAxisX()
                    const isCtrlPressed: boolean = (<MouseEvent>getEvent()).ctrlKey;
                    this.selectionManager
                        .select(d.selectionId, isCtrlPressed)
                        .then((ids: ISelectionId[]) => {
                            if (ids.length > 0) {
                                this.dots.forEach(d => {
                                    d.each(dot => {
                                        ids.forEach(id => {
                                            if (dot.selectionId.equals(id)) {
                                                this.createRectTooltip(dot, xScale, yScale, heightYAxis)
                                                this.createTooltip(viewModel, dot, xScale, fontSizeAxisY, fontSizeLabelY, settings)
                                                this.highlightAxisX()
                                            }
                                        })
                                    })
                                })
                            }
                        });
                    (<Event>getEvent()).stopPropagation();
                }
            })
        );



        this.dots.forEach((d, i) =>
            d.on('mouseover', (dotOver: data) => {
                if (this.host.hostCapabilities.allowInteractions) {
                    if (this.getClickedDots().length === 0) {
                        this.createRectTooltip(dotOver, xScale, yScale, heightYAxis)
                        this.createTooltip(viewModel, dotOver, xScale, fontSizeAxisY, fontSizeLabelY, settings)
                    }
                }
            })
        );


        this.dots.forEach((d, i) =>
            d.on('mouseout', (dotOver: data) => {
                if (this.getClickedDots().length === 0) {
                    this.removeRectTooltip()
                    this.removetooltip()
                }
            })
        );


        this.barSelection.exit().remove();
        this.dataBarSelection.exit().remove();
        this.gradientBarSelection.exit().remove();

    }

    private highlightAxisX() {
        const opacity = BarChart.Config.solidOpacity

        const clickedDots = this.getClickedDots()
        if (clickedDots.length > 0) {
            this.xAxis.selectAll('text')
                .classed('opacityLess', true)

            clickedDots.forEach(dot => {
                this.xAxis.selectAll('text')
                    .filter((d, i) => i === dot.indexDot)
                    .classed('opacityLess', false)

                // .style("fill-opacity", opacity)
                // .style("stroke-opacity", opacity)
            })
        }
    }

    private removeHighlightAxisX() {
        const opacity: number = this.barChartSettings.generalView.opacity / 100;

        this.xAxis
            .selectAll('text')
            .classed('opacityLess', false)
        // .style("fill-opacity", opacity)
        // .style("stroke-opacity", opacity);
    }

    private getClickedDots() {
        let clickedDots: data[] = []
        let dots = this.getDataDots()
        this.selectionManager.getSelectionIds().forEach(function (d: ISelectionId) {
            clickedDots.push(dots.find(f => f.selectionId.equals(d)))
        });

        return clickedDots
    }

    private getDataDots() {
        let clickedDots: data[] = []
        this.dots.forEach(d3Selection => d3Selection.each(data => clickedDots.push(data)))
        return clickedDots
    }

    private redrawRectTooltip(xScale, yScale, heightYAxis) {
        this.removeRectTooltip()
        let clickedDots = this.getClickedDots()
        if (clickedDots.length > 0) {
            clickedDots.forEach(dot => {
                this.createRectTooltip(dot, xScale, yScale, heightYAxis)
            })
        }

    }

    private redrawTooltip(viewModel, xScale, fontSizeAxisY, fontSizeLabelY, settings) {
        this.removetooltip()
        let clickedDots = this.getClickedDots()
        if (clickedDots.length > 0) {
            clickedDots.forEach(dot => {
                this.createTooltip(viewModel, dot, xScale, fontSizeAxisY, fontSizeLabelY, settings)
            })
        }

    }


    private createChart(data: BarChartDataPoint, index: number, xScale: d3.ScaleBand<string>,
        yScale: d3.ScaleLinear<number, number, never>, barContainer: d3.Selection<d3.BaseType, any, d3.BaseType, any>) {

        // функция, создающая по массиву точек линии
        var line = d3.line<{ category: string, value: number }>()
            .x((d) => xScale(d.category))
            .y((d) => yScale(d.value))
            .curve(d3.curveCardinal);

        var g = barContainer.append("g")
            .attr("class", "axis")


        let dataTransform = data.data.map(d => ({ category: <string>d.category, value: <number>d.value }))
        g.append("path")
            .attr("d", line(dataTransform))
            .style("stroke", data.color)
            .style("stroke-width", 3.5);

        // добавляем отметки к точкам
        let dots = g.selectAll(".dot")
            .data(data.data)
            .enter().append("circle")
            .classed('opacityLess', d => d.isClicked)
            .style("stroke", "white")
            .style("stroke-width", 3.5)
            .style("fill", data.color)
            .attr('id', d => d.id)
            .attr("r", d => d.sizeCircle)
            .attr("cx", (d) => { let x = xScale(<string>d.category); d.coordinateX = x; return x })
            .attr("cy", (d) => { let y = yScale(<number>d.value); d.coordinateY = y; return y });


        this.dots[index] = dots

        //this.dots.push(dots)    //массив точек графика
    };



    private createTooltip(viewModel, dotOver: data, xScale, fontSizeAxisY, fontSizeLabelY,
        settings) {

        let findChart = this.barContainer.selectAll('.axis')
            .filter((d, i) => i === dotOver.indexChart)

        let findDot = findChart
            .selectAll('circle')
            .filter((d, i) => i === dotOver.indexDot)

        let widthTooltip = Math.max(settings.tooltip.fontSizeValue, settings.tooltip.fontSizeLabel) * 5  //xScale.bandwidth() * 2
        let heightTooltip = Math.max(settings.tooltip.fontSizeValue, settings.tooltip.fontSizeLabel) * 3
        let coordinateX = parseInt(findDot.attr('cx')) - widthTooltip / 2
        let coordinateY = parseInt(findDot.attr('cy')) - heightTooltip - fontSizeAxisY * 1.5


        let tooltip = this.barContainer.append('g')
            .classed('tooltip', true)

        tooltip.append('rect')
            .attr('x', coordinateX)
            .attr('y', coordinateY)
            .attr('width', widthTooltip)
            .attr('height', heightTooltip)
            .attr('rx', 7)
            .style('fill', 'white')

        let lable =
            tooltip.append('text')
                .classed('yAxis', true)
                .attr('x', coordinateX + widthTooltip / 2)
                .attr('y', coordinateY + heightTooltip / 2.5)
                .attr('font-size', settings.tooltip.fontSizeLabel)
                .attr('text-anchor', 'middle')
                .text(this.barChartSettings.tooltip.labelText)


        let value =
            tooltip.append('text')
                .style('fill-opacity', 0.8)
                .style('font-weight', 600)
                .attr('x', coordinateX + widthTooltip / 2)
                .attr('y', coordinateY + heightTooltip / 1.3)
                .attr('font-size', settings.tooltip.fontSizeValue)
                .attr('text-anchor', 'middle')
                .text(dotOver.value.toString())
                .style('fill', dotOver.color)

        let coordinateXTriangle = coordinateX + widthTooltip / 2.5
        let coordinateYTriangle = coordinateY + heightTooltip * 0.99
        let width = widthTooltip / 5
        let height = heightTooltip / 7
        let triangle = tooltip
            .append('polygon')
            .attr('points',
                `${coordinateXTriangle},${coordinateYTriangle} ${coordinateXTriangle + width / 2},${coordinateYTriangle + height} ${coordinateXTriangle + width},${coordinateYTriangle}`
            )
            .style('fill', 'white')
    }

    private removetooltip() {
        this.barContainer.selectAll('.tooltip').remove()
    }

    private createRectTooltip(dot: data, xScale, yScale, heightYAxis) {
        this.barContainer.insert('rect', 'g')
            .classed('selected', true)
            .attr('rx', 20)
            .attr("width", xScale.bandwidth())
            .attr("height", heightYAxis - yScale(<number>dot.value))
            .attr("y", yScale(<number>dot.value) - dot.sizeCircle * 2.5)
            .attr("x", xScale(<string>dot.category) - xScale.bandwidth() / 2)
            .attr("fill", `url(#Gradient${dot.indexChart + 1})`)
            .style("fill-opacity", 0.2)
    }

    private removeRectTooltip() {
        this.barContainer.selectAll('rect.selected').remove()
    }


    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): powerbi.VisualObjectInstanceEnumeration {
        let objectName = options.objectName;
        let objectEnumeration: VisualObjectInstance[] = [];

        if (!this.barChartSettings ||
            !this.barChartSettings.enableAxisX ||
            !this.barChartSettings.enableAxisY ||
            !this.barDataPoints) {
            return objectEnumeration;
        }

        switch (objectName) {
            case 'title':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        text: this.barChartSettings.title.text,
                        hide: this.barChartSettings.title.hide,
                        fontSizeTitle: this.barChartSettings.title.fontSizeTitle
                    },
                    validValues: {
                        fontSizeTitle: {
                            numberRange: {
                                min: 6,
                                max: 40
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'enableAxisX':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisX.show,
                        fontSize: this.barChartSettings.enableAxisX.fontSize
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'enableAxisY':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        show: this.barChartSettings.enableAxisY.show,
                        label: this.barChartSettings.enableAxisY.label,
                        fontSize: this.barChartSettings.enableAxisY.fontSize,
                        fontSizeLabel: this.barChartSettings.enableAxisY.fontSizeLabel,
                        labelText: this.barChartSettings.enableAxisY.labelText
                    },
                    validValues: {
                        fontSize: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        },
                        fontSizeLabel: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
            case 'colorSelector':

                for (let barDataPoint of this.barDataPoints) {
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: barDataPoint.measureDisplayName,
                        properties: {
                            fill: {
                                solid: {
                                    color: barDataPoint.color
                                }
                            }
                        },
                        selector: barDataPoint.selectionId.getSelector()
                    });
                }
                break;
            case 'generalView':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        sizeDots: this.barChartSettings.generalView.sizeDots,
                    },
                    selector: null
                });
                break;
            case 'tooltip':
                objectEnumeration.push({
                    objectName: objectName,
                    properties: {
                        fontSizeLabel: this.barChartSettings.tooltip.fontSizeLabel,
                        fontSizeValue: this.barChartSettings.tooltip.fontSizeValue,
                        labelText: this.barChartSettings.tooltip.labelText,
                        enableGradient: this.barChartSettings.tooltip.enableGradient
                    },
                    validValues: {
                        fontSizeLabel: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        },
                        fontSizeValue: {
                            numberRange: {
                                min: 6,
                                max: 30
                            }
                        }
                    },
                    selector: null
                });
                break;
        };

        return objectEnumeration;
    }
}